import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'

type Boletim = {
  id: string
  created_at: string
  status: string
  dados_extras: Record<string, unknown>
}

const STATUS_COLORS: Record<string, string> = {
  processado: '#22C55E',
  pendente_revisao: '#F59E0B',
  nao_encontrado: '#EF4444',
  aguardando: '#6366F1',
}

const STATUS_LABELS: Record<string, string> = {
  processado: 'Processado',
  pendente_revisao: 'Revisar',
  nao_encontrado: 'Não encontrado',
  aguardando: 'Aguardando',
}

export default function HomeScreen() {
  const [boletins, setBoletins] = useState<Boletim[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userName, setUserName] = useState('')

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setUserName(user.email.split('@')[0])

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('maquinas_boletins')
      .select('id, created_at, status, dados_extras')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    setBoletins(data ?? [])
  }

  async function fetchAll() {
    setLoading(true)
    await loadData()
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  useEffect(() => { fetchAll() }, [])

  const processados = boletins.filter(b => b.status === 'processado').length
  const pendentes = boletins.filter(b => b.status === 'pendente_revisao').length

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {userName || 'operador'}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/boletim/novo')}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.newButtonText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpi, { borderTopColor: '#3B82F6' }]}>
          <Text style={styles.kpiValue}>{boletins.length}</Text>
          <Text style={styles.kpiLabel}>Hoje</Text>
        </View>
        <View style={[styles.kpi, { borderTopColor: '#22C55E' }]}>
          <Text style={styles.kpiValue}>{processados}</Text>
          <Text style={styles.kpiLabel}>Processados</Text>
        </View>
        <View style={[styles.kpi, { borderTopColor: '#F59E0B' }]}>
          <Text style={styles.kpiValue}>{pendentes}</Text>
          <Text style={styles.kpiLabel}>Pendentes</Text>
        </View>
      </View>

      {/* Lista */}
      <Text style={styles.sectionTitle}>BOLETINS DE HOJE</Text>
      {loading ? (
        <ActivityIndicator color="#06B6D4" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06B6D4" />}
          showsVerticalScrollIndicator={false}
        >
          {boletins.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={40} color="#2A3A50" />
              <Text style={styles.emptyText}>Nenhum boletim hoje</Text>
              <TouchableOpacity onPress={() => router.push('/boletim/novo')}>
                <Text style={styles.emptyLink}>Fotografar boletim agora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            boletins.map(b => (
              <TouchableOpacity
                key={b.id}
                style={styles.card}
                onPress={() => router.push(`/boletim/${b.id}`)}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[b.status] ?? '#6B7280' }]} />
                  <View>
                    <Text style={styles.cardTitle}>
                      {(b.dados_extras as Record<string, string>)?.equipamento ?? 'Equipamento'}
                    </Text>
                    <Text style={styles.cardSub}>
                      {new Date(b.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[b.status] + '20' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[b.status] }]}>
                    {STATUS_LABELS[b.status] ?? b.status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 52, marginBottom: 20,
  },
  greeting: { fontSize: 20, fontWeight: '800', color: '#0D1B2A' },
  date: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  newButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#0D1B2A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  newButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  kpi: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14,
    padding: 14, borderTopWidth: 3, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  kpiValue: { fontSize: 26, fontWeight: '800', color: '#0D1B2A' },
  kpiLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '600' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0D1B2A' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
  emptyLink: { color: '#06B6D4', fontWeight: '600', fontSize: 14, marginTop: 4 },
})
