import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Colours matching solar-shine-dash
const COLORS = {
  solar: '#bad700',
  consumption: '#f97316',
  grid: '#3b82f6',
  muted: '#64748b',
  border: '#334155',
  bg: '#1e293b',
};

interface MonthlyPoint {
  day: number;
  ePv1Day: number;
  ePv2Day: number;
  ePv3Day: number;
  eRecDay: number;
  eToGridDay: number;
  eConsumptionDay: number;
  eChgDay: number;
  eDisChgDay: number;
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

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const MODES: { key: ChartMode; label: string; color: string }[] = [
  { key: 'generation', label: '☀️ Geração', color: COLORS.solar },
  { key: 'consumption', label: '🏠 Consumo', color: COLORS.consumption },
  { key: 'grid', label: '⚡ Injeção', color: COLORS.grid },
];

export function MonthlyBarChart({ data, loading, year, month, onPrevMonth, onNextMonth }: Props) {
  const [mode, setMode] = useState<ChartMode>('generation');

  const activeMode = MODES.find((m) => m.key === mode)!;

  function getValues(): number[] {
    return data.map((p) => {
      let v = 0;
      if (mode === 'generation') v = (p.ePv1Day ?? 0) + (p.ePv2Day ?? 0) + (p.ePv3Day ?? 0);
      else if (mode === 'consumption') v = p.eConsumptionDay ?? 0;
      else v = p.eToGridDay ?? 0;
      return Math.max(0, Number(v.toFixed(2)));
    });
  }

  const values = getValues();
  const total = values.reduce((a, b) => a + b, 0);

  // Max 15 bars for readability
  const step = data.length > 15 ? Math.ceil(data.length / 15) : 1;
  const filtered = data.filter((_, i) => i % step === 0);
  const filteredValues = values.filter((_, i) => i % step === 0);
  const labels = filtered.map((p) => String(p.day));

  const canGoNext = !(
    year === new Date().getFullYear() && month === new Date().getMonth() + 1
  );

  const chartWidth = SCREEN_WIDTH - 64;

  return (
    <View style={styles.card}>
      {/* Month navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.navBtn} disabled={!canGoNext}>
          <Text style={[styles.navArrow, !canGoNext && { color: COLORS.border }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Mode selector */}
      <View style={styles.modeTabs}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[
              styles.modeTab,
              mode === m.key && { backgroundColor: m.color + '22', borderColor: m.color },
            ]}
            onPress={() => setMode(m.key)}
          >
            <Text style={[styles.modeTabText, mode === m.key && { color: m.color }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {mode === 'generation' ? 'Geração do mês' : mode === 'consumption' ? 'Consumo do mês' : 'Injeção do mês'}
        </Text>
        <Text style={[styles.totalValue, { color: activeMode.color }]}>
          {total.toFixed(2)} kWh
        </Text>
      </View>

      {/* Chart */}
      {loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color={activeMode.color} />
          <Text style={[styles.placeholderText, { color: activeMode.color }]}>Carregando...</Text>
        </View>
      ) : filteredValues.length > 0 && filteredValues.some((v) => v > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={{
              labels,
              datasets: [{ data: filteredValues }],
            }}
            width={Math.max(chartWidth, filteredValues.length * 28)}
            height={180}
            yAxisSuffix=""
            yAxisLabel=""
            chartConfig={{
              backgroundColor: '#1e293b',
              backgroundGradientFrom: '#1e293b',
              backgroundGradientTo: '#0f172a',
              decimalPlaces: 1,
              color: (opacity = 1) => activeMode.color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
              labelColor: () => COLORS.muted,
              barPercentage: 0.65,
              propsForBackgroundLines: { stroke: COLORS.border, strokeDasharray: '4' },
            }}
            style={{ borderRadius: 10 }}
            showValuesOnTopOfBars={false}
            fromZero
          />
        </ScrollView>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Sem dados para este mês</Text>
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
    borderColor: COLORS.border,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: { padding: 6 },
  navArrow: { fontSize: 24, color: COLORS.solar, fontWeight: '700' },
  monthLabel: { fontSize: 15, color: '#f8fafc', fontWeight: '800' },
  modeTabs: { flexDirection: 'row', gap: 6 },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modeTabText: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 12, color: COLORS.muted },
  totalValue: { fontSize: 18, fontWeight: '800' },
  placeholder: { height: 180, justifyContent: 'center', alignItems: 'center', gap: 8 },
  placeholderText: { fontSize: 12, color: COLORS.muted },
});
