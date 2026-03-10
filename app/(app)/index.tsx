import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';
import { luxPowerService } from '../../src/services/luxpower';

interface PlantSummary {
  plantId: number;
  name: string;
  inverterCount: number;
  onlineCount: number;
  isOnline: boolean;
  serialNum: string | null;
  powerRatingText: string | null;
  batteryType: string | null;
  lastUpdateTime: string | null;
}

export default function PlantsScreen() {
  const { logout, restoreSession, userName } = useAuthStore();
  const [plants, setPlants] = useState<PlantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [totalOnline, setTotalOnline] = useState(0);

  useEffect(() => {
    setup();
  }, []);

  async function setup() {
    const sessionOk = await restoreSession();
    if (!sessionOk) { router.replace('/(auth)/login'); return; }
    await loadSummary();
  }

  async function loadSummary(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await luxPowerService.getPlantsSummary();
      setPlants(data.plants ?? []);
      setTotalOnline(data.onlineCount ?? 0);
    } catch (e) {
      console.error('[Plants] Erro:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = plants
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => filter === 'all' ? true : filter === 'online' ? p.isOnline : !p.isOnline);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Carregando {plants.length > 0 ? plants.length : ''} instalações...</Text>
        <Text style={styles.loadingSubText}>Isso pode levar alguns segundos</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>⚡ LuxPower</Text>
          <Text style={styles.subtitle}>Olá, {userName?.split(' ')[0]} 👋</Text>
        </View>
        <TouchableOpacity onPress={async () => { await logout(); router.replace('/(auth)/login'); }}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Resumo geral */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: '#10b98144' }]}>
          <Text style={styles.summaryValue}>{plants.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#10b98144' }]}>
          <Text style={[styles.summaryValue, { color: '#10b981' }]}>{totalOnline}</Text>
          <Text style={styles.summaryLabel}>Online</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#ef444444' }]}>
          <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{plants.length - totalOnline}</Text>
          <Text style={styles.summaryLabel}>Offline</Text>
        </View>
      </View>

      {/* Busca */}
      <TextInput
        style={styles.searchInput}
        placeholder="🔍  Buscar instalação..."
        placeholderTextColor="#475569"
        value={search}
        onChangeText={setSearch}
      />

      {/* Filtros */}
      <View style={styles.filterRow}>
        {(['all', 'online', 'offline'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todas' : f === 'online' ? '🟢 Online' : '🔴 Offline'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de cards */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.plantId)}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSummary(true)} tintColor="#f59e0b" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma instalação encontrada</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.isOnline ? styles.cardOnline : styles.cardOffline]}
            onPress={() => router.push({ pathname: '/(app)/dashboard', params: { serialNum: item.serialNum, plantName: item.name } })}
            disabled={!item.serialNum}
          >
            {/* Cabeçalho do card */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.badge, { backgroundColor: item.isOnline ? '#10b98122' : '#ef444422' }]}>
                <View style={[styles.badgeDot, { backgroundColor: item.isOnline ? '#10b981' : '#ef4444' }]} />
                <Text style={[styles.badgeText, { color: item.isOnline ? '#10b981' : '#ef4444' }]}>
                  {item.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            {/* Infos do inversor */}
            <View style={styles.cardInfo}>
              <View style={styles.cardInfoItem}>
                <Text style={styles.cardInfoLabel}>Modelo</Text>
                <Text style={styles.cardInfoValue}>{item.powerRatingText ?? '—'}</Text>
              </View>
              <View style={styles.cardInfoItem}>
                <Text style={styles.cardInfoLabel}>Bateria</Text>
                <Text style={styles.cardInfoValue}>{item.batteryType ?? '—'}</Text>
              </View>
              <View style={styles.cardInfoItem}>
                <Text style={styles.cardInfoLabel}>Inversores</Text>
                <Text style={styles.cardInfoValue}>
                  {item.onlineCount}/{item.inverterCount}
                </Text>
              </View>
            </View>

            {/* Rodapé */}
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>
                {item.lastUpdateTime ? `Atualizado: ${item.lastUpdateTime}` : 'Sem dados recentes'}
              </Text>
              {item.serialNum && (
                <Text style={styles.cardArrow}>Ver detalhes →</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#94a3b8', marginTop: 16, fontSize: 15, fontWeight: '600' },
  loadingSubText: { color: '#475569', marginTop: 6, fontSize: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 48 },
  logo: { fontSize: 22, fontWeight: '800', color: '#f59e0b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutText: { fontSize: 12, color: '#475569', marginTop: 6 },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#f8fafc' },
  summaryLabel: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' },
  searchInput: {
    backgroundColor: '#1e293b', color: '#f8fafc', padding: 12,
    marginHorizontal: 16, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155', fontSize: 14,
  },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  filterBtnActive: { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' },
  filterText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  filterTextActive: { color: '#f59e0b' },
  card: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#334155',
  },
  cardOnline: { borderLeftWidth: 3, borderLeftColor: '#10b981' },
  cardOffline: { borderLeftWidth: 3, borderLeftColor: '#ef4444', opacity: 0.75 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#f8fafc', flex: 1, marginRight: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardInfo: { flexDirection: 'row', gap: 0, marginBottom: 12 },
  cardInfoItem: { flex: 1 },
  cardInfoLabel: { fontSize: 10, color: '#475569', fontWeight: '600', letterSpacing: 0.5 },
  cardInfoValue: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  cardFooterText: { fontSize: 10, color: '#475569' },
  cardArrow: { fontSize: 11, color: '#f59e0b', fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#475569', fontSize: 14 },
});