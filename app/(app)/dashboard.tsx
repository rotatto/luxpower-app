import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { useRealtime } from '../../src/hooks/useRealtime';
import { luxPowerService } from '../../src/services/luxpower';
import { EnergyKPICards } from '../../src/components/EnergyKPICards';
import { MonthlyBarChart } from '../../src/components/MonthlyBarChart';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChartPoint {
  time: string;
  soc: number;
  grid: number;
  battery: number;
  consumption: number;
}

export default function DashboardScreen() {
  const { serialNum, plantName } = useLocalSearchParams<{ serialNum: string; plantName: string }>();
  const { data, isLoading, refetch, isRefetching } = useRealtime(serialNum);
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeChart, setActiveChart] = useState<'soc' | 'grid' | 'battery' | 'consumption'>('soc');

  const [energyInfo, setEnergyInfo] = useState<Record<string, string>>({});
  const [loadingEnergy, setLoadingEnergy] = useState(true);

  const now = new Date();
  const [chartMonth, setChartMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);

  useEffect(() => {
    if (serialNum) {
      loadHistory();
      loadEnergyInfo();
    }
  }, [serialNum]);

  useEffect(() => {
    if (serialNum) loadMonthly(chartMonth.year, chartMonth.month);
  }, [serialNum, chartMonth]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const result = await luxPowerService.getHistory(serialNum);
      console.log('[Dashboard] Histórico raw:', JSON.stringify(result).substring(0, 500));

      if (result?.data) {
        const parsed = parseHistory(result.data);
        setHistory(parsed);
      }
    } catch (e) {
      console.error('[Dashboard] Erro histórico:', e);
      // Gera dados simulados se a API não retornar histórico
      setHistory(generateMockHistory());
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

  function handlePrevMonth() {
    setChartMonth((prev) => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function handleNextMonth() {
    setChartMonth((prev) => {
      const today = new Date();
      if (prev.year === today.getFullYear() && prev.month === today.getMonth() + 1) return prev;
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  function parseHistory(raw: any): ChartPoint[] {
    // A API pode retornar em diferentes formatos — tentamos os mais comuns
    const points: ChartPoint[] = [];

    if (Array.isArray(raw)) {
      raw.forEach((item: any) => {
        points.push({
          time: item.time ?? item.dateTime ?? '',
          soc: Number(item.soc ?? 0),
          grid: Number(item.pToGrid ?? item.grid ?? 0),
          battery: Number(item.batPower ?? item.battery ?? 0),
          consumption: Number(item.consumptionPower ?? item.consumption ?? 0),
        });
      });
    } else if (raw.soc && Array.isArray(raw.soc)) {
      // Formato { soc: [], grid: [], ... }
      raw.soc.forEach((val: any, i: number) => {
        points.push({
          time: `${i}h`,
          soc: Number(val ?? 0),
          grid: Number(raw.pToGrid?.[i] ?? 0),
          battery: Number(raw.batPower?.[i] ?? 0),
          consumption: Number(raw.consumptionPower?.[i] ?? 0),
        });
      });
    }

    return points.length > 0 ? points : generateMockHistory();
  }

  function generateMockHistory(): ChartPoint[] {
    // Dados simulados para demonstração enquanto mapeamos a API correta
    return Array.from({ length: 24 }, (_, i) => ({
      time: `${i}h`,
      soc: Math.max(10, Math.min(100, 60 + Math.sin(i / 4) * 25)),
      grid: Math.sin(i / 3) * 800,
      battery: Math.cos(i / 3) * 600,
      consumption: 1500 + Math.sin(i / 2) * 500,
    }));
  }

  const isOffline = data?.lost === true;
  const soc = data?.soc ?? 0;
  const totalSolar = (data?.ppv1 ?? 0) + (data?.ppv2 ?? 0) + (data?.ppv3 ?? 0);
  const consumption = data?.consumptionPower ?? 0;
  const batPower = data?.batPower ?? 0;
  const pToGrid = data?.pToGrid ?? 0;

  const socColor = isOffline ? '#475569' : soc > 60 ? '#10b981' : soc > 30 ? '#f59e0b' : '#ef4444';
  const gridColor = pToGrid < -50 ? '#ef4444' : pToGrid > 50 ? '#3b82f6' : '#64748b';
  const batDirection = batPower < -50 ? '⬇ Descarregando' : batPower > 50 ? '⬆ Carregando' : '● Repouso';
  const gridStatus = pToGrid < -50 ? 'Importando' : pToGrid > 50 ? 'Exportando' : 'Balanceado';

  // Configuração dos gráficos
  const chartConfigs = {
    soc: {
      label: 'SOC — Nível da Bateria',
      color: socColor,
      data: history.map(p => Math.max(0, p.soc)),
      unit: '%',
      gradient: ['#10b981', '#059669'],
    },
    grid: {
      label: 'Rede Elétrica',
      color: '#3b82f6',
      data: history.map(p => Math.abs(p.grid) / 1000),
      unit: 'kW',
      gradient: ['#3b82f6', '#2563eb'],
    },
    battery: {
      label: 'Potência da Bateria',
      color: '#f59e0b',
      data: history.map(p => Math.abs(p.battery) / 1000),
      unit: 'kW',
      gradient: ['#f59e0b', '#d97706'],
    },
    consumption: {
      label: 'Consumo da Casa',
      color: '#a78bfa',
      data: history.map(p => Math.max(0, p.consumption) / 1000),
      unit: 'kW',
      gradient: ['#a78bfa', '#7c3aed'],
    },
  };

  const active = chartConfigs[activeChart];

  // Reduz pontos para o gráfico (máx 12 para legibilidade)
  const chartData = active.data.length > 12
    ? active.data.filter((_, i) => i % Math.ceil(active.data.length / 12) === 0)
    : active.data;

  const chartLabels = history.length > 12
    ? history
        .filter((_, i) => i % Math.ceil(history.length / 12) === 0)
        .map(p => p.time.replace(':00', 'h').substring(0, 4))
    : history.map(p => p.time.replace(':00', 'h').substring(0, 4));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); loadHistory(); loadEnergyInfo(); loadMonthly(chartMonth.year, chartMonth.month); }} tintColor="#f59e0b" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Voltar</Text>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: isOffline ? '#ef444422' : '#10b98122' }]}>
          <View style={[styles.badgeDot, { backgroundColor: isOffline ? '#ef4444' : '#10b981' }]} />
          <Text style={[styles.badgeText, { color: isOffline ? '#ef4444' : '#10b981' }]}>
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

      {/* Cards de métricas em tempo real */}
      <Text style={styles.sectionTitle}>TEMPO REAL</Text>
      <View style={styles.metricsGrid}>
        {[
          { icon: '🔋', label: 'SOC', value: `${soc}%`, color: socColor },
          { icon: '☀️', label: 'Solar', value: `${(totalSolar / 1000).toFixed(1)}kW`, color: '#f59e0b' },
          { icon: '🏠', label: 'Consumo', value: `${(consumption / 1000).toFixed(1)}kW`, color: '#a78bfa' },
          { icon: '🔌', label: gridStatus, value: `${(Math.abs(pToGrid) / 1000).toFixed(1)}kW`, color: gridColor },
        ].map((m, i) => (
          <View key={i} style={[styles.metricCard, isOffline && { opacity: 0.5 }]}>
            <Text style={styles.metricIcon}>{m.icon}</Text>
            <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* KPIs de Energia */}
      <Text style={styles.sectionTitle}>ENERGIA — HOJE / TOTAL</Text>
      {loadingEnergy ? (
        <View style={styles.energyLoading}>
          <ActivityIndicator color="#f59e0b" size="small" />
        </View>
      ) : (
        <EnergyKPICards data={energyInfo} />
      )}

      {/* Bateria */}
      <View style={[styles.card, isOffline && { opacity: 0.5 }]}>
        <Text style={styles.cardLabel}>BATERIA</Text>
        <View style={styles.batteryRow}>
          <View style={styles.batteryBarContainer}>
            <View style={[styles.batteryFill, { width: `${soc}%`, backgroundColor: socColor }]} />
          </View>
          <Text style={[styles.socText, { color: socColor }]}>{soc}%</Text>
        </View>
        <Text style={styles.cardSub}>
          {isOffline ? 'Sem dados' : `${batDirection} — ${Math.abs(batPower)} W`}
        </Text>
      </View>

      {/* Seletor de gráfico */}
      <Text style={styles.sectionTitle}>GRÁFICO DO DIA</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartTabsScroll}>
        <View style={styles.chartTabs}>
          {(Object.entries(chartConfigs) as [typeof activeChart, typeof chartConfigs.soc][]).map(([key, cfg]) => (
            <TouchableOpacity
              key={key}
              style={[styles.chartTab, activeChart === key && { backgroundColor: cfg.color + '33', borderColor: cfg.color }]}
              onPress={() => setActiveChart(key)}
            >
              <Text style={[styles.chartTabText, activeChart === key && { color: cfg.color }]}>
                {key === 'soc' ? '🔋 SOC' : key === 'grid' ? '🔌 Rede' : key === 'battery' ? '⚡ Bateria' : '🏠 Consumo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Gráfico */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{active.label}</Text>
        {loadingHistory ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator color={active.color} />
            <Text style={[styles.chartLoadingText, { color: active.color }]}>Carregando histórico...</Text>
          </View>
        ) : chartData.length > 1 ? (
          <LineChart
            data={{
              labels: chartLabels,
              datasets: [{ data: chartData.map(v => isNaN(v) ? 0 : v), color: () => active.color }],
            }}
            width={SCREEN_WIDTH - 32}
            height={200}
            yAxisSuffix={active.unit === '%' ? '%' : ''}
            chartConfig={{
              backgroundColor: '#1e293b',
              backgroundGradientFrom: '#1e293b',
              backgroundGradientTo: '#0f172a',
              decimalPlaces: 1,
              color: () => active.color,
              labelColor: () => '#64748b',
              propsForDots: { r: '3', strokeWidth: '2', stroke: active.color },
              propsForBackgroundLines: { stroke: '#334155', strokeDasharray: '4' },
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        ) : (
          <View style={styles.chartLoading}>
            <Text style={styles.chartLoadingText}>Sem dados históricos disponíveis</Text>
          </View>
        )}

        {/* Resumo do gráfico */}
        {chartData.length > 0 && (
          <View style={styles.chartSummary}>
            <View style={styles.chartSummaryItem}>
              <Text style={styles.chartSummaryLabel}>Mínimo</Text>
              <Text style={[styles.chartSummaryValue, { color: active.color }]}>
                {Math.min(...chartData).toFixed(1)}{active.unit}
              </Text>
            </View>
            <View style={styles.chartSummaryItem}>
              <Text style={styles.chartSummaryLabel}>Médio</Text>
              <Text style={[styles.chartSummaryValue, { color: active.color }]}>
                {(chartData.reduce((a, b) => a + b, 0) / chartData.length).toFixed(1)}{active.unit}
              </Text>
            </View>
            <View style={styles.chartSummaryItem}>
              <Text style={styles.chartSummaryLabel}>Máximo</Text>
              <Text style={[styles.chartSummaryValue, { color: active.color }]}>
                {Math.max(...chartData).toFixed(1)}{active.unit}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Gráfico Mensal */}
      <Text style={styles.sectionTitle}>HISTÓRICO MENSAL</Text>
      <MonthlyBarChart
        data={monthlyData}
        loading={loadingMonthly}
        year={chartMonth.year}
        month={chartMonth.month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Inversor */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>INVERSOR</Text>
        <Text style={styles.inverterModel}>{data?.powerRatingText ?? '—'} — {data?.batteryType ?? '—'}</Text>
        <Text style={styles.cardSub}>Serial: {serialNum}</Text>
        <Text style={styles.cardSub}>Firmware: {data?.fwCode ?? '—'}</Text>
        <Text style={styles.cardSub}>Última atualização: {data?.deviceTime ?? '—'}</Text>
      </View>

      <Text style={styles.footer}>Atualiza a cada 30s · Puxe para atualizar</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48 },
  backBtn: { fontSize: 14, color: '#f59e0b', fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  plantName: { fontSize: 20, fontWeight: '800', color: '#f8fafc', paddingHorizontal: 20, marginBottom: 16 },
  offlineBanner: { backgroundColor: '#ef444420', borderWidth: 1, borderColor: '#ef444440', margin: 16, borderRadius: 12, padding: 12 },
  offlineTitle: { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  offlineSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sectionTitle: { fontSize: 11, color: '#475569', fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  metricCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155', width: '47%' },
  metricIcon: { fontSize: 24, marginBottom: 6 },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: '600' },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  batteryBarContainer: { flex: 1, height: 20, backgroundColor: '#0f172a', borderRadius: 10, overflow: 'hidden' },
  batteryFill: { height: '100%', borderRadius: 10 },
  socText: { fontSize: 22, fontWeight: '800', minWidth: 52, textAlign: 'right' },
  chartTabsScroll: { marginBottom: 10 },
  chartTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  chartTab: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  chartTabText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  chartCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  chartTitle: { fontSize: 13, color: '#94a3b8', fontWeight: '700', marginBottom: 14 },
  chartLoading: { height: 200, justifyContent: 'center', alignItems: 'center', gap: 10 },
  chartLoadingText: { fontSize: 13, color: '#475569' },
  chartSummary: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#334155' },
  chartSummaryItem: { alignItems: 'center' },
  chartSummaryLabel: { fontSize: 10, color: '#475569', fontWeight: '600' },
  chartSummaryValue: { fontSize: 16, fontWeight: '800', marginTop: 3 },
  inverterModel: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  footer: { textAlign: 'center', color: '#334155', fontSize: 11, padding: 20 },
  energyLoading: { height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
});