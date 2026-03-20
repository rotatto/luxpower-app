import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { useRealtime } from '../../src/hooks/useRealtime';
import { luxPowerService } from '../../src/services/luxpower';
import { EnergyKPICards } from '../../src/components/EnergyKPICards';
import { MonthlyBarChart } from '../../src/components/MonthlyBarChart';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Design tokens (matching solar-shine-dash) ─────────────────────────────────
const C = {
  solar: '#bad700',
  grid: 'hsl(0, 85%, 55%)',      // red
  battery: 'hsl(142, 76%, 45%)', // green
  consumption: 'hsl(280, 65%, 55%)', // purple
  soc: 'hsl(45, 93%, 47%)',      // amber
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  muted: '#64748b',
  sub: '#94a3b8',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChartPoint {
  time: string;
  soc: number;
  grid: number;       // W  (gridPower from API)
  battery: number;    // W  (batteryDischarging from API)
  consumption: number;// W  (consumption from API)
  solar: number;      // W  (solarPv from API)
}

type ChartTab = 'power' | 'soc';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeArr(arr: number[]): number[] {
  return arr.map((v) => (isNaN(v) || !isFinite(v) ? 0 : v));
}

function kw(w: number) {
  return Math.abs(w) / 1000;
}

function formatKw(w: number) {
  return `${(Math.abs(w) / 1000).toFixed(1)}kW`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { serialNum, plantName } = useLocalSearchParams<{ serialNum: string; plantName: string }>();
  const { data, isLoading, refetch, isRefetching } = useRealtime(serialNum);

  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chartTab, setChartTab] = useState<ChartTab>('power');

  const [energyInfo, setEnergyInfo] = useState<Record<string, string>>({});
  const [loadingEnergy, setLoadingEnergy] = useState(true);

  const now = new Date();
  const [chartMonth, setChartMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!serialNum) return;
    loadHistory();
    loadEnergyInfo();
  }, [serialNum]);

  useEffect(() => {
    if (!serialNum) return;
    loadMonthly(chartMonth.year, chartMonth.month);
  }, [serialNum, chartMonth]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const result = await luxPowerService.getHistory(serialNum);
      const raw = result?.data;
      if (Array.isArray(raw) && raw.length > 0) {
        setHistory(parseHistory(raw));
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error('[Dashboard] Erro histórico:', e);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadEnergyInfo() {
    setLoadingEnergy(true);
    try {
      const result = await luxPowerService.getEnergyInfo(serialNum);
      setEnergyInfo(result ?? {});
    } catch (e) {
      console.error('[Dashboard] Erro energyInfo:', e);
    } finally {
      setLoadingEnergy(false);
    }
  }

  async function loadMonthly(year: number, month: number) {
    setLoadingMonthly(true);
    try {
      const result = await luxPowerService.getMonthly(serialNum, year, month);
      setMonthlyData(Array.isArray(result) ? result : []);
    } catch (e) {
      console.error('[Dashboard] Erro monthly:', e);
      setMonthlyData([]);
    } finally {
      setLoadingMonthly(false);
    }
  }

  // ── History parser ─────────────────────────────────────────────────────────
  // LuxPower history fields: time, solarPv, gridPower, consumption, soc, batteryDischarging
  function parseHistory(raw: any[]): ChartPoint[] {
    return raw.map((item: any) => ({
      time: String(item.time ?? ''),
      soc: toNum(item.soc),
      grid: toNum(item.gridPower),
      battery: toNum(item.batteryDischarging),
      consumption: toNum(item.consumption),
      solar: toNum(item.solarPv),
    }));
  }

  // ── Month navigation ───────────────────────────────────────────────────────
  function handlePrevMonth() {
    setChartMonth((prev) =>
      prev.month === 1
        ? { year: prev.year - 1, month: 12 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }

  function handleNextMonth() {
    setChartMonth((prev) => {
      const today = new Date();
      if (prev.year === today.getFullYear() && prev.month === today.getMonth() + 1) return prev;
      return prev.month === 12
        ? { year: prev.year + 1, month: 1 }
        : { year: prev.year, month: prev.month + 1 };
    });
  }

  // ── Realtime values ────────────────────────────────────────────────────────
  const isOffline = data?.lost === true;
  const soc = toNum(data?.soc);
  const totalSolar = toNum(data?.ppv1) + toNum(data?.ppv2) + toNum(data?.ppv3);
  const consumption = toNum(data?.consumptionPower);
  const batPower = toNum(data?.batPower);
  const pToGrid = toNum(data?.pToGrid);

  const socColor = isOffline ? C.muted : soc > 60 ? C.battery : soc > 30 ? C.soc : C.grid;
  const gridIsExporting = pToGrid > 50;
  const gridIsImporting = pToGrid < -50;

  // ── Chart data ─────────────────────────────────────────────────────────────
  // Reduce to ≤ 48 points for performance
  const reduced = useMemo(() => {
    if (history.length <= 48) return history;
    const step = Math.ceil(history.length / 48);
    return history.filter((_, i) => i % step === 0);
  }, [history]);

  const labels = useMemo(
    () => reduced.map((p) => p.time.substring(0, 5)),
    [reduced]
  );

  // Show every 6th label to avoid crowding
  const sparseLabels = labels.map((l, i) => (i % 6 === 0 ? l : ''));

  // Power chart: solar, grid, battery, consumption — all in kW
  const powerDatasets = useMemo(() => {
    const solar = safeArr(reduced.map((p) => kw(p.solar)));
    const grid  = safeArr(reduced.map((p) => kw(p.grid)));
    const bat   = safeArr(reduced.map((p) => kw(p.battery)));
    const cons  = safeArr(reduced.map((p) => kw(p.consumption)));
    return { solar, grid, bat, cons };
  }, [reduced]);

  // SOC chart
  const socData = useMemo(
    () => safeArr(reduced.map((p) => Math.max(0, Math.min(100, p.soc)))),
    [reduced]
  );

  // Peak values for power lines
  const peaks = useMemo(() => {
    if (!history.length) return null;
    let maxSolar = { val: 0, time: '--' };
    let maxCons  = { val: 0, time: '--' };
    let maxBat   = { val: 0, time: '--' };
    history.forEach((p) => {
      if (p.solar > maxSolar.val) maxSolar = { val: p.solar, time: p.time.substring(0, 5) };
      if (p.consumption > maxCons.val) maxCons = { val: p.consumption, time: p.time.substring(0, 5) };
      if (p.battery > maxBat.val) maxBat = { val: p.battery, time: p.time.substring(0, 5) };
    });
    return { maxSolar, maxCons, maxBat };
  }, [history]);

  const hasHistory = reduced.length > 1;

  const chartConfig = {
    backgroundColor: C.card,
    backgroundGradientFrom: C.card,
    backgroundGradientTo: C.bg,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(186, 215, 0, ${opacity})`,
    labelColor: () => C.muted,
    propsForDots: { r: '0' },
    propsForBackgroundLines: { stroke: C.border, strokeDasharray: '4' },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            refetch();
            loadHistory();
            loadEnergyInfo();
            loadMonthly(chartMonth.year, chartMonth.month);
          }}
          tintColor={C.solar}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Voltar</Text>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: isOffline ? '#ef444422' : '#22c55e22' }]}>
          <View style={[styles.badgeDot, { backgroundColor: isOffline ? '#ef4444' : C.battery }]} />
          <Text style={[styles.badgeText, { color: isOffline ? '#ef4444' : C.battery }]}>
            {isOffline ? 'Offline' : 'Online'}
          </Text>
        </View>
      </View>

      <Text style={styles.plantName} numberOfLines={2}>{plantName}</Text>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTitle}>⚠️ Inversor offline</Text>
          <Text style={styles.offlineSub}>Última comunicação: {data?.deviceTime ?? '—'}</Text>
        </View>
      )}

      {/* ── Tempo Real ── */}
      <Text style={styles.sectionLabel}>TEMPO REAL</Text>
      <View style={styles.metricsGrid}>
        {[
          { icon: '☀️', label: 'Solar', value: formatKw(totalSolar), color: C.solar },
          { icon: '🔋', label: `SOC ${soc}%`, value: `${batPower > 50 ? '⬆' : batPower < -50 ? '⬇' : '●'} ${formatKw(batPower)}`, color: socColor },
          { icon: '🏠', label: 'Consumo', value: formatKw(consumption), color: C.consumption },
          {
            icon: '🔌',
            label: gridIsExporting ? 'Exportando' : gridIsImporting ? 'Importando' : 'Balanceado',
            value: formatKw(pToGrid),
            color: gridIsExporting ? C.battery : gridIsImporting ? C.grid : C.muted,
          },
        ].map((m) => (
          <View key={m.label} style={[styles.metricCard, isOffline && { opacity: 0.4 }]}>
            <Text style={styles.metricIcon}>{m.icon}</Text>
            <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Bateria SOC bar ── */}
      <View style={[styles.card, isOffline && { opacity: 0.4 }]}>
        <Text style={styles.cardLabel}>BATERIA</Text>
        <View style={styles.batteryRow}>
          <View style={styles.batteryBarBg}>
            <View style={[styles.batteryFill, { width: `${soc}%` as any, backgroundColor: socColor }]} />
          </View>
          <Text style={[styles.socText, { color: socColor }]}>{soc}%</Text>
        </View>
        <Text style={styles.cardSub}>
          {isOffline ? 'Sem dados' :
            batPower > 50 ? `⬆ Carregando — ${batPower}W` :
            batPower < -50 ? `⬇ Descarregando — ${Math.abs(batPower)}W` :
            '● Repouso'}
        </Text>
      </View>

      {/* ── KPIs Energia ── */}
      <Text style={styles.sectionLabel}>ENERGIA — HOJE / TOTAL</Text>
      <EnergyKPICards data={energyInfo} loading={loadingEnergy} />

      {/* ── Gráfico do Dia ── */}
      <Text style={styles.sectionLabel}>MONITORAMENTO DO DIA</Text>

      {/* Tab power / SOC */}
      <View style={styles.chartTabs}>
        {([
          { key: 'power', label: 'Potência' },
          { key: 'soc', label: 'SOC Bateria' },
        ] as { key: ChartTab; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chartTab, chartTab === t.key && styles.chartTabActive]}
            onPress={() => setChartTab(t.key)}
          >
            <Text style={[styles.chartTabText, chartTab === t.key && { color: C.solar }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chartCard}>
        {/* Peak info (power tab only) */}
        {chartTab === 'power' && peaks && (
          <View style={styles.peaksRow}>
            {[
              { label: 'Solar pico', val: peaks.maxSolar.val, time: peaks.maxSolar.time, color: C.solar },
              { label: 'Consumo pico', val: peaks.maxCons.val, time: peaks.maxCons.time, color: C.consumption },
              { label: 'Bateria pico', val: peaks.maxBat.val, time: peaks.maxBat.time, color: C.battery },
            ].map((p) => (
              <View key={p.label} style={styles.peakItem}>
                <View style={[styles.peakDot, { backgroundColor: p.color }]} />
                <View>
                  <Text style={styles.peakLabel}>{p.label}</Text>
                  <Text style={[styles.peakValue, { color: p.color }]}>
                    {formatKw(p.val)} <Text style={styles.peakTime}>({p.time})</Text>
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Legend (power tab) */}
        {chartTab === 'power' && (
          <View style={styles.legend}>
            {[
              { label: 'Solar', color: C.solar },
              { label: 'Rede', color: C.grid },
              { label: 'Bateria', color: C.battery },
              { label: 'Consumo', color: C.consumption },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        )}

        {loadingHistory ? (
          <View style={styles.chartPlaceholder}>
            <ActivityIndicator color={C.solar} />
            <Text style={[styles.chartPlaceholderText, { color: C.solar }]}>Carregando histórico...</Text>
          </View>
        ) : !hasHistory ? (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>Sem dados históricos disponíveis</Text>
          </View>
        ) : chartTab === 'soc' ? (
          <LineChart
            data={{
              labels: sparseLabels,
              datasets: [{ data: socData, color: () => C.soc, strokeWidth: 2 }],
            }}
            width={SCREEN_WIDTH - 32}
            height={200}
            yAxisSuffix="%"
            chartConfig={{ ...chartConfig, color: () => C.soc }}
            bezier
            style={styles.chart}
            withDots={false}
            withShadow={false}
          />
        ) : (
          // Power: 4 lines — react-native-chart-kit supports multiple datasets
          <LineChart
            data={{
              labels: sparseLabels,
              datasets: [
                { data: powerDatasets.solar, color: () => C.solar, strokeWidth: 2 },
                { data: powerDatasets.grid,  color: () => C.grid,  strokeWidth: 2 },
                { data: powerDatasets.bat,   color: () => C.battery, strokeWidth: 2 },
                { data: powerDatasets.cons,  color: () => C.consumption, strokeWidth: 2 },
              ],
            }}
            width={SCREEN_WIDTH - 32}
            height={200}
            yAxisSuffix="k"
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={false}
            withShadow={false}
          />
        )}
      </View>

      {/* ── Histórico Mensal ── */}
      <Text style={styles.sectionLabel}>HISTÓRICO MENSAL</Text>
      <MonthlyBarChart
        data={monthlyData}
        loading={loadingMonthly}
        year={chartMonth.year}
        month={chartMonth.month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* ── Inversor ── */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>INVERSOR</Text>
        <Text style={styles.inverterModel}>{data?.powerRatingText ?? '—'}</Text>
        <Text style={styles.cardSub}>Bateria: {data?.batteryType ?? '—'}</Text>
        <Text style={styles.cardSub}>Serial: {serialNum}</Text>
        <Text style={styles.cardSub}>Última atualização: {data?.deviceTime ?? '—'}</Text>
      </View>

      <Text style={styles.footer}>Atualiza a cada 30s · Puxe para atualizar</Text>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48 },
  backBtn: { fontSize: 14, color: C.solar, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  plantName: { fontSize: 20, fontWeight: '800', color: C.text, paddingHorizontal: 20, marginBottom: 4 },

  // Offline
  offlineBanner: { backgroundColor: '#ef444420', borderWidth: 1, borderColor: '#ef444440', margin: 16, borderRadius: 12, padding: 12 },
  offlineTitle: { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  offlineSub: { fontSize: 11, color: C.sub, marginTop: 2 },

  // Section
  sectionLabel: { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10, marginTop: 16 },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  metricCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, width: '47%' },
  metricIcon: { fontSize: 24, marginBottom: 6 },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: C.muted, marginTop: 3, fontWeight: '600' },

  // Card
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardLabel: { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  cardSub: { fontSize: 12, color: C.muted, marginTop: 4 },

  // Battery bar
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  batteryBarBg: { flex: 1, height: 18, backgroundColor: C.bg, borderRadius: 9, overflow: 'hidden' },
  batteryFill: { height: '100%', borderRadius: 9 },
  socText: { fontSize: 20, fontWeight: '800', minWidth: 50, textAlign: 'right' },

  // Chart tabs
  chartTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  chartTab: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chartTabActive: { backgroundColor: C.solar + '22', borderColor: C.solar },
  chartTabText: { fontSize: 12, color: C.muted, fontWeight: '600' },

  // Chart card
  chartCard: { backgroundColor: C.card, borderRadius: 16, paddingTop: 16, paddingBottom: 12, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  chart: { borderRadius: 12 },
  chartPlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center', gap: 10 },
  chartPlaceholderText: { fontSize: 13, color: C.muted },

  // Peaks
  peaksRow: { gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  peakItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  peakDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  peakLabel: { fontSize: 10, color: C.muted, fontWeight: '600' },
  peakValue: { fontSize: 13, fontWeight: '700' },
  peakTime: { fontSize: 10, color: C.muted, fontWeight: '400' },

  // Legend
  legend: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.muted },

  // Inversor
  inverterModel: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },

  // Footer
  footer: { textAlign: 'center', color: C.border, fontSize: 11, padding: 20 },
});
