import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { format, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRealtime } from '../../src/hooks/useRealtime';
import { luxPowerService } from '../../src/services/luxpower';
import { EnergyKPICards } from '../../src/components/EnergyKPICards';
import { MonthlyBarChart } from '../../src/components/MonthlyBarChart';

const SW = Dimensions.get('window').width;

// ── Design tokens idênticos ao solar-shine-dash ───────────────────────────────
const C = {
  solar: 'hsl(36, 100%, 50%)',    // laranja-solar (igual solar-shine-dash)
  grid: 'hsl(0, 85%, 55%)',       // vermelho
  battery: 'hsl(142, 76%, 45%)',  // verde
  consumption: 'hsl(280, 65%, 55%)', // roxo
  soc: 'hsl(45, 93%, 47%)',       // âmbar
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  muted: '#64748b',
  sub: '#94a3b8',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface HistoryPoint {
  timeLabel: string;
  solarPv: number;
  gridPower: number;
  consumption: number;
  soc: number;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Extrai HH:MM de "2024-03-20 14:30:00" ou timestamps similares */
function extractTimeLabel(t: string): string {
  if (!t) return '';
  const spaceIdx = t.indexOf(' ');
  if (spaceIdx !== -1) return t.substring(spaceIdx + 1, spaceIdx + 6);
  return t.slice(-5);
}

function safeArr(arr: number[]): number[] {
  return arr.map((v) => (isNaN(v) || !isFinite(v) ? 0 : v));
}

function formatW(w: number): string {
  const abs = Math.abs(w);
  if (abs >= 1000) return `${(w / 1000).toFixed(2)}kW`;
  return `${Math.round(w)}W`;
}

function dateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { serialNum, plantName } = useLocalSearchParams<{ serialNum: string; plantName: string }>();
  const { data: raw, isRefetching, refetch } = useRealtime(serialNum);

  // ── History ──────────────────────────────────────────────────────────────
  const [historyDate, setHistoryDate] = useState(new Date());
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // ── Energy Info (KPIs) ────────────────────────────────────────────────────
  const [energyInfo, setEnergyInfo] = useState<Record<string, string>>({});
  const [loadingEnergy, setLoadingEnergy] = useState(true);

  // ── Monthly ───────────────────────────────────────────────────────────────
  const now = new Date();
  const [chartMonth, setChartMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);

  // ── Line visibility ───────────────────────────────────────────────────────
  const [vis, setVis] = useState({ solar: true, grid: true, consumption: true, soc: true });

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!serialNum) return;
    loadEnergyInfo();
  }, [serialNum]);

  useEffect(() => {
    if (!serialNum) return;
    loadHistory(historyDate);
  }, [serialNum, historyDate]);

  useEffect(() => {
    if (!serialNum) return;
    loadMonthly(chartMonth.year, chartMonth.month);
  }, [serialNum, chartMonth]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  async function loadHistory(date: Date) {
    setLoadingHistory(true);
    try {
      const pts = await luxPowerService.getHistory(serialNum, dateStr(date));
      setHistoryPoints(
        Array.isArray(pts)
          ? pts.map((p: any) => ({
              // Campos exatos da API LuxPower (mesmos do solar-shine-dash)
              timeLabel: extractTimeLabel(String(p.time ?? '')),
              solarPv: toNum(p.solarPv),
              gridPower: toNum(p.gridPower),
              consumption: toNum(p.consumption),
              soc: Math.max(0, Math.min(100, toNum(p.soc))),
            }))
          : []
      );
    } catch (e) {
      console.error('[Dashboard] Erro histórico:', e);
      setHistoryPoints([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadEnergyInfo() {
    setLoadingEnergy(true);
    try {
      const info = await luxPowerService.getEnergyInfo(serialNum);
      setEnergyInfo(info ?? {});
    } catch (e) {
      console.error('[Dashboard] Erro energyInfo:', e);
    } finally {
      setLoadingEnergy(false);
    }
  }

  async function loadMonthly(year: number, month: number) {
    setLoadingMonthly(true);
    try {
      const data = await luxPowerService.getMonthly(serialNum, year, month);
      setMonthlyData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[Dashboard] Erro monthly:', e);
      setMonthlyData([]);
    } finally {
      setLoadingMonthly(false);
    }
  }

  // ── Month navigation ──────────────────────────────────────────────────────
  function prevMonth() {
    setChartMonth((p) =>
      p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 }
    );
  }
  function nextMonth() {
    const today = new Date();
    if (chartMonth.year === today.getFullYear() && chartMonth.month === today.getMonth() + 1) return;
    setChartMonth((p) =>
      p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 }
    );
  }

  // ── Realtime values (mesma lógica do solar-shine-dash fetchLuxRealtime) ───
  const isOnline = raw?.lost === false;
  const soc     = toNum(raw?.soc);
  const ppv     = toNum(raw?.ppv1) + toNum(raw?.ppv2) + toNum(raw?.ppv3);
  const batPwr  = toNum(raw?.batPower);
  const consPwr = toNum(raw?.consumptionPower);
  const pToGrid = toNum(raw?.pToGrid);
  const pToUser = toNum(raw?.pToUser);
  // rawGridPower: positivo = importando, negativo = exportando (igual solar-shine-dash)
  const rawGrid = pToUser - pToGrid;

  const socColor = soc > 60 ? C.battery : soc > 30 ? C.soc : C.grid;
  const isToday = dateStr(historyDate) === dateStr(new Date());

  // ── History chart data ────────────────────────────────────────────────────
  // Reduz para ≤ 60 pontos para performance
  const reduced = useMemo(() => {
    if (historyPoints.length <= 60) return historyPoints;
    const step = Math.ceil(historyPoints.length / 60);
    return historyPoints.filter((_, i) => i % step === 0);
  }, [historyPoints]);

  const sparseLabels = useMemo(
    () => reduced.map((p, i) => (i % 8 === 0 ? p.timeLabel : '')),
    [reduced]
  );

  // Peaks (igual solar-shine-dash)
  const peaks = useMemo(() => {
    let solar = { value: 0, time: '--:--' };
    let grid  = { value: 0, time: '--:--' };
    let cons  = { value: 0, time: '--:--' };
    historyPoints.forEach((p) => {
      if (Math.abs(p.solarPv)   > Math.abs(solar.value)) solar = { value: p.solarPv,   time: p.timeLabel };
      if (Math.abs(p.gridPower) > Math.abs(grid.value))  grid  = { value: p.gridPower, time: p.timeLabel };
      if (Math.abs(p.consumption) > Math.abs(cons.value)) cons = { value: p.consumption, time: p.timeLabel };
    });
    return { solar, grid, cons };
  }, [historyPoints]);

  // Chart datasets
  const chartDatasets = useMemo(() => {
    const solar = safeArr(reduced.map((p) => p.solarPv / 1000));
    const grid  = safeArr(reduced.map((p) => p.gridPower / 1000));
    const cons  = safeArr(reduced.map((p) => p.consumption / 1000));
    const socD  = safeArr(reduced.map((p) => p.soc));
    return { solar, grid, cons, socD };
  }, [reduced]);

  const hasHistory = reduced.length > 1;

  // ── Monthly totals ────────────────────────────────────────────────────────
  const monthlyTotal = useMemo(
    () => monthlyData.reduce((s, p) => s + ((p.ePv1Day ?? 0) + (p.ePv2Day ?? 0) + (p.ePv3Day ?? 0)), 0),
    [monthlyData]
  );

  // ── Refresh all ──────────────────────────────────────────────────────────
  function refreshAll() {
    refetch();
    loadEnergyInfo();
    loadHistory(historyDate);
    loadMonthly(chartMonth.year, chartMonth.month);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.root}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshAll} tintColor={C.solar} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backBtn}>← Voltar</Text>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: isOnline ? '#22c55e22' : '#ef444422' }]}>
          <View style={[styles.badgeDot, { backgroundColor: isOnline ? C.battery : '#ef4444' }]} />
          <Text style={[styles.badgeText, { color: isOnline ? C.battery : '#ef4444' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      <Text style={styles.plantName} numberOfLines={2}>{plantName ?? 'Dashboard'}</Text>
      <Text style={styles.plantSub}>LuxPower · {raw?.powerRatingText ?? '—'}</Text>

      {/* ══ TEMPO REAL ══════════════════════════════════════════════════════ */}
      <Text style={styles.section}>TEMPO REAL</Text>

      <View style={styles.grid4}>
        {[
          { label: 'Solar', val: formatW(ppv),    color: C.solar,       icon: '☀️' },
          { label: isOnline && batPwr > 50 ? 'Carregando' : batPwr < -50 ? 'Descarregando' : 'Bateria', val: formatW(batPwr), color: socColor, icon: '🔋' },
          { label: 'Consumo', val: formatW(consPwr), color: C.consumption, icon: '🏠' },
          { label: rawGrid > 50 ? 'Importando' : rawGrid < -50 ? 'Exportando' : 'Grid', val: formatW(Math.abs(rawGrid)), color: rawGrid > 50 ? '#ef4444' : rawGrid < -50 ? C.battery : C.muted, icon: '⚡' },
        ].map((m) => (
          <View key={m.label} style={[styles.metCard, !isOnline && { opacity: 0.35 }]}>
            <Text style={styles.metIcon}>{m.icon}</Text>
            <Text style={[styles.metVal, { color: m.color }]}>{m.val}</Text>
            <Text style={styles.metLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Bateria SOC */}
      <View style={[styles.card, !isOnline && { opacity: 0.35 }]}>
        <View style={styles.socRow}>
          <View style={styles.socBarBg}>
            <View style={[styles.socFill, { width: `${soc}%` as any, backgroundColor: socColor }]} />
          </View>
          <Text style={[styles.socPct, { color: socColor }]}>{soc}%</Text>
        </View>
        <Text style={styles.cardSub}>{raw?.batteryType ?? '—'} · SOC da bateria</Text>
      </View>

      {/* ══ KPI ENERGIA ═════════════════════════════════════════════════════ */}
      <Text style={styles.section}>ENERGIA — HOJE / TOTAL</Text>
      <EnergyKPICards data={energyInfo} loading={loadingEnergy} />

      {/* ══ HISTÓRICO DO DIA ════════════════════════════════════════════════ */}
      <Text style={styles.section}>HISTÓRICO DO DIA</Text>

      {!historyExpanded ? (
        /* Card colapsado — igual solar-shine-dash */
        <TouchableOpacity style={styles.card} onPress={() => setHistoryExpanded(true)}>
          <View style={styles.row}>
            <View style={styles.activityCircle}>
              <Text style={{ fontSize: 18 }}>📈</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Histórico do Dia</Text>
              <Text style={styles.cardSub}>
                Acompanhe o <Text style={{ color: C.solar }}>comportamento da energia</Text> ao longo das últimas 24h.
              </Text>
            </View>
          </View>
          <Text style={[styles.cardSub, { color: C.solar, marginTop: 12 }]}>
            Visualizar fluxo detalhado →
          </Text>
        </TouchableOpacity>
      ) : (
        /* Card expandido */
        <View style={styles.card}>
          {/* Header com data e fechar */}
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Monitoramento do Dia</Text>
              <Text style={styles.cardSub}>
                {isToday ? 'Atualização a cada 5 minutos' : 'Dados históricos'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setHistoryExpanded(false)}>
              <Text style={{ color: C.muted, fontSize: 22, lineHeight: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navegação de data */}
          <View style={[styles.row, { justifyContent: 'center', marginVertical: 12, gap: 16 }]}>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setHistoryDate((d) => subDays(d, 1))}
            >
              <Text style={styles.dateBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.dateLabel}>
              {format(historyDate, "dd/MM/yyyy", { locale: ptBR })}
            </Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => !isToday && setHistoryDate((d) => addDays(d, 1))}
            >
              <Text style={[styles.dateBtnText, isToday && { color: C.border }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Peaks — igual solar-shine-dash */}
          {hasHistory && (
            <View style={styles.peaksRow}>
              {[
                { label: 'Solar pico',  val: peaks.solar.value, time: peaks.solar.time, color: C.solar },
                { label: 'Rede pico',   val: peaks.grid.value,  time: peaks.grid.time,  color: C.grid },
                { label: 'Consumo pico', val: peaks.cons.value, time: peaks.cons.time,  color: C.consumption },
              ].map((p) => (
                <View key={p.label} style={styles.peakItem}>
                  <View style={[styles.peakDot, { backgroundColor: p.color }]} />
                  <View>
                    <Text style={styles.peakLabel}>{p.label}</Text>
                    <Text style={[styles.peakVal, { color: p.color }]}>
                      {formatW(p.val)}{' '}
                      <Text style={styles.peakTime}>({p.time})</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Toggle linhas (igual solar-shine-dash) */}
          <View style={styles.legendRow}>
            {([
              { key: 'solar' as const,       label: 'Solar',   color: C.solar },
              { key: 'grid' as const,        label: 'Rede',    color: C.grid },
              { key: 'consumption' as const, label: 'Consumo', color: C.consumption },
              { key: 'soc' as const,         label: 'SOC',     color: C.soc },
            ] as const).map((l) => (
              <TouchableOpacity
                key={l.key}
                style={[styles.legendChip, !vis[l.key] && { opacity: 0.35 }]}
                onPress={() => setVis((v) => ({ ...v, [l.key]: !v[l.key] }))}
              >
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Gráfico */}
          {loadingHistory ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator color={C.solar} />
              <Text style={[styles.cardSub, { marginTop: 6 }]}>Carregando dados do dia...</Text>
            </View>
          ) : !hasHistory ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.cardSub}>Sem dados para esta data</Text>
            </View>
          ) : (
            (() => {
              // Constrói datasets apenas com as linhas visíveis
              const datasets: { data: number[]; color: () => string; strokeWidth: number }[] = [];
              if (vis.solar)       datasets.push({ data: chartDatasets.solar, color: () => C.solar,       strokeWidth: 2 });
              if (vis.grid)        datasets.push({ data: chartDatasets.grid,  color: () => C.grid,        strokeWidth: 2 });
              if (vis.consumption) datasets.push({ data: chartDatasets.cons,  color: () => C.consumption, strokeWidth: 2 });
              // SOC em escala separada: normaliza para mesma faixa de kW
              if (vis.soc) {
                const maxPwr = Math.max(
                  ...chartDatasets.solar, ...chartDatasets.grid, ...chartDatasets.cons, 0.1
                );
                datasets.push({
                  data: safeArr(chartDatasets.socD.map((v) => (v / 100) * maxPwr)),
                  color: () => C.soc,
                  strokeWidth: 2,
                });
              }
              if (datasets.length === 0) {
                datasets.push({ data: [0], color: () => C.muted, strokeWidth: 1 });
              }
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <LineChart
                    data={{ labels: sparseLabels, datasets }}
                    width={Math.max(SW - 32, reduced.length * 8)}
                    height={220}
                    yAxisSuffix="k"
                    chartConfig={{
                      backgroundColor: C.card,
                      backgroundGradientFrom: C.card,
                      backgroundGradientTo: C.bg,
                      decimalPlaces: 1,
                      color: () => C.solar,
                      labelColor: () => C.muted,
                      propsForDots: { r: '0' },
                      propsForBackgroundLines: { stroke: C.border, strokeDasharray: '4' },
                    }}
                    bezier
                    style={{ borderRadius: 12 }}
                    withDots={false}
                    withShadow={false}
                  />
                </ScrollView>
              );
            })()
          )}
        </View>
      )}

      {/* ══ GERAÇÃO SOLAR (mensal) ═══════════════════════════════════════════ */}
      <Text style={styles.section}>GERAÇÃO SOLAR</Text>
      <MonthlyBarChart
        data={monthlyData}
        loading={loadingMonthly}
        year={chartMonth.year}
        month={chartMonth.month}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

      {/* ══ INFORMAÇÕES DO INVERSOR ══════════════════════════════════════════ */}
      <View style={styles.card}>
        <Text style={styles.section} numberOfLines={1}>INVERSOR</Text>
        <View style={styles.infoGrid}>
          {[
            { label: 'Modelo',       val: raw?.powerRatingText ?? '—' },
            { label: 'Bateria',      val: raw?.batteryType     ?? '—' },
            { label: 'Serial',       val: serialNum            ?? '—' },
            { label: 'Atualizado',   val: raw?.deviceTime      ?? '—' },
          ].map((r) => (
            <View key={r.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{r.label}</Text>
              <Text style={styles.infoVal} numberOfLines={1}>{r.val}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.footer}>Puxe para atualizar · intervalo 30s</Text>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 4 },
  backBtn: { fontSize: 14, color: C.solar, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  plantName: { fontSize: 22, fontWeight: '800', color: C.text, paddingHorizontal: 20, marginTop: 8 },
  plantSub: { fontSize: 12, color: C.muted, paddingHorizontal: 20, marginBottom: 4 },

  section: { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },

  // Metrics 2×2 grid
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  metCard: { width: '47%', backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  metIcon: { fontSize: 24, marginBottom: 4 },
  metVal: { fontSize: 17, fontWeight: '800' },
  metLabel: { fontSize: 11, color: C.muted, marginTop: 3, fontWeight: '600', textAlign: 'center' },

  // Generic card
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  cardSub: { fontSize: 12, color: C.sub, marginTop: 3 },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  activityCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.solar + '99', justifyContent: 'center', alignItems: 'center' },

  // SOC bar
  socRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  socBarBg: { flex: 1, height: 18, backgroundColor: C.bg, borderRadius: 9, overflow: 'hidden' },
  socFill: { height: '100%', borderRadius: 9 },
  socPct: { fontSize: 20, fontWeight: '800', minWidth: 52, textAlign: 'right' },

  // Date nav
  dateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  dateBtnText: { fontSize: 24, color: C.solar, fontWeight: '700', lineHeight: 28 },
  dateLabel: { fontSize: 15, color: C.text, fontWeight: '700', minWidth: 110, textAlign: 'center' },

  // Peaks
  peaksRow: { gap: 8, marginBottom: 10 },
  peakItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  peakDot: { width: 8, height: 8, borderRadius: 4, marginTop: 1 },
  peakLabel: { fontSize: 10, color: C.muted, fontWeight: '600' },
  peakVal: { fontSize: 13, fontWeight: '700' },
  peakTime: { fontSize: 10, color: C.muted, fontWeight: '400' },

  // Legend chips
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: C.sub },

  // Chart placeholder
  chartPlaceholder: { height: 220, justifyContent: 'center', alignItems: 'center' },

  // Inversor info
  infoGrid: { gap: 8, marginTop: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  infoVal: { fontSize: 12, color: C.text, flex: 1, textAlign: 'right' },

  footer: { textAlign: 'center', color: C.border, fontSize: 11, padding: 24 },
});
