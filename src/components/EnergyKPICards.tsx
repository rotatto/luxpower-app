import { View, Text, StyleSheet } from 'react-native';

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
}

interface KPIItem {
  icon: string;
  label: string;
  today: string;
  total: string;
  color: string;
}

export function EnergyKPICards({ data }: Props) {
  const kpis: KPIItem[] = [
    {
      icon: '☀️',
      label: 'Geração Solar',
      today: data.todayYieldingText ?? '—',
      total: data.totalYieldingText ?? '—',
      color: '#f59e0b',
    },
    {
      icon: '🔋',
      label: 'Descarga Bateria',
      today: data.todayDischargingText ?? '—',
      total: data.totalDischargingText ?? '—',
      color: '#10b981',
    },
    {
      icon: '🔌',
      label: 'Exportação Rede',
      today: data.todayExportText ?? '—',
      total: data.totalExportText ?? '—',
      color: '#3b82f6',
    },
    {
      icon: '🏠',
      label: 'Consumo',
      today: data.eLoadDayText ?? '—',
      total: data.totalUsageText ?? '—',
      color: '#a78bfa',
    },
  ];

  return (
    <View style={styles.grid}>
      {kpis.map((kpi) => (
        <View key={kpi.label} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.icon}>{kpi.icon}</Text>
            <Text style={styles.label}>{kpi.label}</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.subLabel}>Hoje</Text>
              <Text style={[styles.value, { color: kpi.color }]}>{kpi.today}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.col}>
              <Text style={styles.subLabel}>Total</Text>
              <Text style={[styles.value, { color: kpi.color }]}>{kpi.total}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    width: '47%',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  icon: { fontSize: 16 },
  label: { fontSize: 11, color: '#64748b', fontWeight: '700', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  col: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 30, backgroundColor: '#334155' },
  subLabel: { fontSize: 9, color: '#475569', fontWeight: '600', marginBottom: 3 },
  value: { fontSize: 14, fontWeight: '800' },
});
