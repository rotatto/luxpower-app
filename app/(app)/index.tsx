import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';
import { luxPowerService } from '../../src/services/luxpower';

type Provider = 'luxpower' | 'deye';

export default function PlantsScreen() {
  const { logout, restoreSession, userName } = useAuthStore();
  const [provider, setProvider] = useState<Provider>('luxpower');
  const [luxPlants, setLuxPlants] = useState<any[]>([]);
  const [deyeStations, setDeyeStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [luxOnline, setLuxOnline] = useState(0);
  const [deyeOnline, setDeyeOnline] = useState(0);

  useEffect(() => {
    setup();
  }, []);

  async function setup() {
    const sessionOk = await restoreSession();
    if (!sessionOk) { router.replace('/(auth)/login'); return; }
    await loadAll();
  }

  async function loadAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Carrega LuxPower e Deye em paralelo
      const [luxData, deyeData] = await Promise.allSettled([
        luxPowerService.getPlantsSummary(),
        luxPowerService.getDeyeStations(),
      ]);

      if (luxData.status === 'fulfilled') {
        setLuxPlants(luxData.value.plants ?? []);
        setLuxOnline(luxData.value.onlineCount ?? 0);
      }

      if (deyeData.status === 'fulfilled') {
        setDeyeStations(deyeData.value ?? []);
        // Deye não tem status online ainda, conta todos por enquanto
        setDeyeOnline(deyeData.value?.length ?? 0);
      }

    } catch (e) {
      console.error('[Plants] Erro:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const currentList = provider === 'luxpower' ? luxPlants : deyeStations;
  const currentOnline = provider === 'luxpower' ? luxOnline : deyeOnline;

  const filtered = currentList
    .filter(p => (p.name ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter(p => {
      if (filter === 'all') return true;
      if (filter === 'online') return p.isOnline !== false;
      return p.isOnline === false;
    });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Carregando instalações...</Text>
        <Text style={styles.loadingSubText}>LuxPower + Deye</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>⚡ YouOn Energy</Text>
          <Text style={styles.subtitle}>Olá, {userName?.split(' ')[0]} 👋</Text>
        </View>
        <TouchableOpacity onPress={async () => { await logout(); router.replace('/(auth)/login'); }}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Abas LuxPower / Deye */}
      <View style={styles.providerTabs}>
        <TouchableOpacity
          style={[styles.providerTab, provider === 'luxpower' && styles.providerTabActive]}
          onPress={() => { setProvider('luxpower'); setSearch(''); setFilter('all'); }}
        >
          <Text style={[styles.providerTabText, provider === 'luxpower' && styles.providerTabTextActive]}>
            ⚡ LuxPower
          </Text>
          <Text style={[styles.providerCount, provider === 'luxpower' && { color: '#f59e0b' }]}>
            {luxPlants.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.providerTab, provider === 'deye' && styles.providerTabActive]}
          onPress={() => { setProvider('deye'); setSearch(''); setFilter('all'); }}
        >
          <Text style={[styles.providerTabText, provider === 'deye' && styles.providerTabTextActive]}>
            ☀️ Deye
          </Text>
          <Text style={[styles.providerCount, provider === 'deye' && { color: '#f59e0b' }]}>
            {deyeStations.length}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Resumo */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{currentList.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#10b98144' }]}>
          <Text style={[styles.summaryValue, { color: '#10b981' }]}>{currentOnline}</Text>
          <Text style={styles.summaryLabel}>Online</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#ef444444' }]}>
          <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
            {currentList.length - currentOnline}
          </Text>
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

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${provider}-${index}-${String(item.plantId ?? item.id)}`}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#f59e0b" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma instalação encontrada</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLux = provider === 'luxpower';
          const isOnline = item.isOnline !== false;
          const hasDetail = isLux ? !!item.serialNum : !!item.id;

          return (
            <TouchableOpacity
              style={[styles.card, isOnline ? styles.cardOnline : styles.cardOffline]}
              onPress={() => {
                if (isLux && item.serialNum) {
                  router.push({ pathname: '/(app)/dashboard', params: { serialNum: item.serialNum, plantName: item.name } });
                } else if (!isLux && item.id) {
                  router.push({ pathname: '/(app)/dashboard', params: { stationId: item.id, plantName: item.name, provider: 'deye' } });
                }
              }}
              disabled={!hasDetail}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: isOnline ? '#10b98122' : '#ef444422' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
                  <Text style={[styles.badgeText, { color: isOnline ? '#10b981' : '#ef4444' }]}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>

              {/* Infos LuxPower */}
              {isLux && (
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
                    <Text style={styles.cardInfoValue}>{item.onlineCount}/{item.inverterCount}</Text>
                  </View>
                </View>
              )}

              {/* Infos Deye */}
              {!isLux && (
                <View style={styles.cardInfo}>
                  <View style={styles.cardInfoItem}>
                    <Text style={styles.cardInfoLabel}>Endereço</Text>
                    <Text style={styles.cardInfoValue} numberOfLines={1}>
                      {item.locationAddress ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.cardInfoItem}>
                    <Text style={styles.cardInfoLabel}>ID</Text>
                    <Text style={styles.cardInfoValue}>{item.id}</Text>
                  </View>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>
                  {item.lastUpdateTime ? `Atualizado: ${item.lastUpdateTime}` : '—'}
                </Text>
                {hasDetail && <Text style={styles.cardArrow}>Ver detalhes →</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
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
  logo: { fontSize: 20, fontWeight: '800', color: '#f59e0b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutText: { fontSize: 12, color: '#475569', marginTop: 6 },
  providerTabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 4 },
  providerTab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
  providerTabActive: { backgroundColor: '#0f172a' },
  providerTabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  providerTabTextActive: { color: '#f59e0b' },
  providerCount: { fontSize: 11, fontWeight: '800', color: '#475569', backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#f8fafc' },
  summaryLabel: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' },
  searchInput: { backgroundColor: '#1e293b', color: '#f8fafc', padding: 12, marginHorizontal: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155', fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  filterBtnActive: { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' },
  filterText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  filterTextActive: { color: '#f59e0b' },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardOnline: { borderLeftWidth: 3, borderLeftColor: '#10b981' },
  cardOffline: { borderLeftWidth: 3, borderLeftColor: '#ef4444', opacity: 0.75 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#f8fafc', flex: 1, marginRight: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardInfo: { flexDirection: 'row', marginBottom: 12 },
  cardInfoItem: { flex: 1 },
  cardInfoLabel: { fontSize: 10, color: '#475569', fontWeight: '600', letterSpacing: 0.5 },
  cardInfoValue: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  cardFooterText: { fontSize: 10, color: '#475569' },
  cardArrow: { fontSize: 11, color: '#f59e0b', fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#475569', fontSize: 14 },
});