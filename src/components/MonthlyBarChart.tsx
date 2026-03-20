import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MonthlyPoint {
  day: number;
  ePv1Day?: number;
  ePv2Day?: number;
  ePv3Day?: number;
  eConsumptionDay?: number;
  eToGridDay?: number;
  eChgDay?: number;
  eDisChgDay?: number;
}

type ChartMode = 'generation' | 'consumption' | 'grid';

interface Props {
  data: MonthlyPoint[];
  loading: boolean;
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthlyBarChart({ data, loading, year, month, onPrevMonth, onNextMonth }: Props) {
  const [mode, setMode] = useState<ChartMode>('generation');

  const modes: { key: ChartMode; label: string; color: string }[] = [
    { key: 'generation', label: '☀️ Geração', color: '#f59e0b' },
    { key: 'consumption', label: '🏠 Consumo', color: '#a78bfa' },
    { key: 'grid', label: '🔌 Rede', color: '#3b82f6' },
  ];

  function getValues(): number[] {
    if (!data.length) return [];
    return data.map((p) => {
      if (mode === 'generation') {
        return Number(((p.ePv1Day ?? 0) + (p.ePv2Day ?? 0) + (p.ePv3Day ?? 0)).toFixed(2));
      }
      if (mode === 'consumption') return Number((p.eConsumptionDay ?? 0).toFixed(2));
      return Number((p.eToGridDay ?? 0).toFixed(2));
    });
  }

  const values = getValues();
  const total = values.reduce((a, b) => a + b, 0).toFixed(1);
  const activeMode = modes.find((m) => m.key === mode)!;

  // Mostra apenas dias com dados, máx 15 barras para legibilidade
  const step = data.length > 15 ? Math.ceil(data.length / 15) : 1;
  const filteredData = data.filter((_, i) => i % step === 0);
  const filteredValues = values.filter((_, i) => i % step === 0);

  const chartLabels = filteredData.map((p) => String(p.day));

  const canGoNext = !(year === new Date().getFullYear() && month === new Date().getMonth() + 1);

  return (
    <View style={styles.card}>
      {/* Header com navegação de mês */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.navBtn} disabled={!canGoNext}>
          <Text style={[styles.navBtnText, !canGoNext && { color: '#334155' }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Seletor de modo */}
      <View style={styles.modeTabs}>
        {modes.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeTab, mode === m.key && { backgroundColor: m.color + '22', borderColor: m.color }]}
            onPress={() => setMode(m.key)}
          >
            <Text style={[styles.modeTabText, mode === m.key && { color: m.color }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total do mês */}
      <Text style={[styles.totalText, { color: activeMode.color }]}>
        Total: <Text style={styles.totalValue}>{total} kWh</Text>
      </Text>

      {/* Gráfico */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={activeMode.color} />
          <Text style={[styles.loadingText, { color: activeMode.color }]}>Carregando...</Text>
        </View>
      ) : filteredValues.length > 0 ? (
        <BarChart
          data={{
            labels: chartLabels,
            datasets: [{ data: filteredValues.map((v) => (isNaN(v) || v < 0 ? 0 : v)) }],
          }}
          width={SCREEN_WIDTH - 64}
          height={180}
          yAxisSuffix=""
          yAxisLabel=""
          chartConfig={{
            backgroundColor: '#1e293b',
            backgroundGradientFrom: '#1e293b',
            backgroundGradientTo: '#0f172a',
            decimalPlaces: 1,
            color: () => activeMode.color,
            labelColor: () => '#64748b',
            barPercentage: 0.7,
            propsForBackgroundLines: { stroke: '#334155', strokeDasharray: '4' },
          }}
          style={{ borderRadius: 10, marginLeft: -10 }}
          showValuesOnTopOfBars={false}
          fromZero
        />
      ) : (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Sem dados para este mês</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 6 },
  navBtnText: { fontSize: 22, color: '#f59e0b', fontWeight: '700' },
  monthLabel: { fontSize: 15, color: '#f8fafc', fontWeight: '800' },
  modeTabs: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  modeTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  modeTabText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  totalText: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  totalValue: { fontWeight: '800' },
  loadingBox: { height: 180, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 12, color: '#475569' },
});
