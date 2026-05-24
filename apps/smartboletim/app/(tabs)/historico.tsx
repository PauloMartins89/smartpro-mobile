import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
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

export default function HistoricoScreen() {
  const [boletins, setBoletins] = useState<Boletim[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('maquinas_boletins')
      .select('id, created_at, status, dados_extras')
      .order('created_at', { ascending: false })
      .limit(50)
    setBoletins(data ?? [])
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Histórico</Text>
      {loading ? (
        <ActivityIndicator color="#06B6D4" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06B6D4" />}
          showsVerticalScrollIndicator={false}
        >
          {boletins.map(b => (
            <TouchableOpacity
              key={b.id}
              style={styles.card}
              onPress={() => router.push(`/boletim/${b.id}`)}
            >
              <View style={[styles.dot, { backgroundColor: STATUS_COLORS[b.status] ?? '#6B7280' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {(b.dados_extras as Record<string, string>)?.equipamento ?? 'Equipamento'}
                </Text>
                <Text style={styles.cardDate}>
                  {new Date(b.created_at).toLocaleString('pt-BR')}
                </Text>
              </View>
              <Text style={[styles.status, { color: STATUS_COLORS[b.status] ?? '#6B7280' }]}>
                {b.status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D1B2A', marginTop: 52, marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0D1B2A' },
  cardDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  status: { fontSize: 11, fontWeight: '700' },
})
