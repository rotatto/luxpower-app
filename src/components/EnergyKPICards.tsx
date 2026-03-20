import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

// Colours matching solar-shine-dash design system
const COLORS = {
  solar: '#bad700',
  battery: '#22c55e',
  grid: '#3b82f6',
  consumption: '#f97316',
  muted: '#64748b',
  border: '#1e293b',
  bg: '#0f172a',
  card: '#0f172a',
  text: '#f8fafc',
  subtext: '#94a3b8',
};

interface EnergyInfo {
  todayYieldingText?: string;
  totalYieldingText?: string;
  todayDischargingText?: string;
  totalDischargingText?: string;
  todayExportText?: string;
  totalExportText?: string;
  eLoadDayText?: string;
  totalUsageText?: string;
}

interface Props {
  data: EnergyInfo;
  loading?: boolean;
}

function withUnit(val: string | undefined): string {
  if (!val || val.trim() === '') return '— kWh';
  const trimmed = val.trim();
  if (/kwh|mwh|wh/i.test(trimmed)) return trimmed;
  return `${trimmed} kWh`;
}

interface KPIItem {
  icon: string;
  label: string;
  today: string;
  total: string;
  accent: string;
}

function KPICard({ item }: { item: KPIItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: item.accent + '22' }]}>
          <Text style={styles.iconText}>{item.icon}</Text>
        </View>
        <Text style={styles.label}>{item.label}</Text>
      </View>

      <View style={styles.todayBlock}>
        <Text style={[styles.todayValue, { color: item.accent }]}>{item.today}</Text>
        <Text style={styles.todayLabel}>Hoje</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totalBlock}>
        <Text style={styles.totalValue}>{item.total}</Text>
        <Text style={styles.totalLabel}>Total acumulado</Text>
      </View>
    </View>
  );
}

export function EnergyKPICards({ data, loading }: Props) {
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={COLORS.solar} />
      </View>
    );
  }

  const kpis: KPIItem[] = [
    {
      icon: '☀️',
      label: 'Produção Solar',
      today: withUnit(data.todayYieldingText),
      total: withUnit(data.totalYieldingText),
      accent: COLORS.solar,
    },
    {
      icon: '🔋',
      label: 'Descarga Bateria',
      today: withUnit(data.todayDischargingText),
      total: withUnit(data.totalDischargingText),
      accent: COLORS.battery,
    },
    {
      icon: '⚡',
      label: 'Injeção na Rede',
      today: withUnit(data.todayExportText),
      total: withUnit(data.totalExportText),
      accent: COLORS.grid,
    },
    {
      icon: '🏠',
      label: 'Consumo',
      today: withUnit(data.eLoadDayText),
      total: withUnit(data.totalUsageText),
      accent: COLORS.consumption,
    },
  ];

  return (
    <View style={styles.grid}>
      {kpis.map((item) => (
        <KPICard key={item.label} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    width: '47%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontSize: 16 },
  label: {
    fontSize: 11,
    color: COLORS.subtext,
    fontWeight: '600',
    flex: 1,
  },
  todayBlock: { gap: 2 },
  todayValue: { fontSize: 18, fontWeight: '800' },
  todayLabel: { fontSize: 10, color: COLORS.muted },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  totalBlock: { gap: 2 },
  totalValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  totalLabel: { fontSize: 10, color: COLORS.muted },
  loadingBox: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
});
