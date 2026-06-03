// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, fmtDate, TURNO_LABEL } from '../../src/lib/theme'

const TURNO_COLOR = {
  manha: { text: '#D97706', bg: '#FEF9C3', icon: 'sunny-outline' },
  tarde: { text: '#C2410C', bg: '#FFEDD5', icon: 'partly-sunny-outline' },
  noite: { text: '#5B21B6', bg: '#EDE9FE', icon: 'moon-outline' },
}

function StatusBadge({ status }: { status: string }) {
  const isAberto = status === 'aberto'
  return (
    <View style={[sb.badge, { backgroundColor: isAberto ? C.greenBg : C.bgMuted }]}>
      <View style={[sb.dot, { backgroundColor: isAberto ? C.green : C.textMuted }]} />
      <Text style={[sb.text, { color: isAberto ? C.greenText : C.textSub }]}>
        {isAberto ? 'Aberto' : 'Fechado'}
      </Text>
    </View>
  )
}
const sb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  text:  { fontSize: 11, fontWeight: '700' },
})

function fmtDiaSemana(iso: string) {
  if (!iso) return ''
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return dias[new Date(iso + 'T12:00:00').getDay()]
}

function TurnoCard({ item, onPress }: { item: any; onPress: () => void }) {
  const tc = TURNO_COLOR[item.turno] ?? { text: C.textSub, bg: C.bgMuted, icon: 'time-outline' }
  return (
    <TouchableOpacity style={t.card} onPress={onPress} activeOpacity={0.82}>
      <View style={[t.turnoStripe, { backgroundColor: tc.bg }]}>
        <Ionicons name={tc.icon as any} size={18} color={tc.text} />
        <Text style={[t.turnoLabel, { color: tc.text }]}>{TURNO_LABEL[item.turno] ?? item.turno}</Text>
      </View>
      <View style={t.body}>
        <View style={t.row}>
          <Text style={t.diasemana}>{fmtDiaSemana(item.data)}</Text>
          <Text style={t.data}>{fmtDate(item.data)}</Text>
          <View style={{ flex: 1 }} />
          <StatusBadge status={item.status} />
        </View>
        <Text style={t.equipeText} numberOfLines={1}>
          {[item.frente_nome, item.equipe_nome].filter(Boolean).join(' · ') || 'Sem frente/equipe'}
        </Text>
        {item.lider_nome ? (
          <Text style={t.liderText} numberOfLines={1}>Líder: {item.lider_nome}</Text>
        ) : null}
        {item.fechado_em ? (
          <Text style={t.fechadoText}>
            Fechado: {new Date(item.fechado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}
const t = StyleSheet.create({
  card:        { backgroundColor: C.bgCard, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  turnoStripe: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  turnoLabel:  { fontSize: 13, fontWeight: '700' },
  body:        { paddingHorizontal: 16, paddingVertical: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  diasemana:   { fontSize: 13, fontWeight: '700', color: C.text, minWidth: 28 },
  data:        { fontSize: 13, fontWeight: '600', color: C.textSub },
  equipeText:  { fontSize: 13, color: C.text, fontWeight: '600', marginBottom: 2 },
  liderText:   { fontSize: 12, color: C.textSub },
  fechadoText: { fontSize: 11, color: C.textMuted, marginTop: 2 },
})

// ── Tela ─────────────────────────────────────────────────────────────────────
export default function HistoricoTurnosScreen() {
  const nav          = useNavigation()
  const router       = useRouter()
  const insets       = useSafeAreaInsets()
  const liderPerfil  = useLiderStore(s => s.liderPerfil)
  const setTurnoAtivo= useLiderStore(s => s.setTurnoAtivo)

  const [turnos,     setTurnos]    = useState([])
  const [loading,    setLoading]   = useState(true)
  const [refreshing, setRefreshing]= useState(false)

  useEffect(() => { nav.setOptions({ title: 'Histórico de Turnos' }) }, [])

  const carregar = useCallback(async (isRefresh = false) => {
    if (!liderPerfil?.equipe_id) return
    isRefresh ? setRefreshing(true) : setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - 60)
    const { data } = await supabase
      .from('lider_turnos')
      .select('id, data, turno, status, frente_nome, equipe_nome, lider_nome, fechado_em')
      .eq('equipe_id', liderPerfil.equipe_id)
      .gte('data', since.toISOString().slice(0, 10))
      .order('data', { ascending: false })
      .order('turno', { ascending: true })
    setTurnos(data ?? [])
    isRefresh ? setRefreshing(false) : setLoading(false)
  }, [liderPerfil?.equipe_id])

  useEffect(() => { carregar() }, [carregar])

  function handlePress(item: any) {
    if (item.status === 'aberto') {
      Alert.alert(
        'Turno em aberto',
        `${fmtDate(item.data)} · ${TURNO_LABEL[item.turno] ?? item.turno}\n\nDeseja retomar este turno?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Retomar Turno',
            onPress: () => {
              setTurnoAtivo({
                id:          item.id,
                frente_id:   liderPerfil?.frente_id ?? '',
                frente_nome: item.frente_nome ?? liderPerfil?.frente_nome ?? '',
                equipe_id:   item.equipe_id ?? liderPerfil?.equipe_id ?? '',
                equipe_nome: item.equipe_nome ?? liderPerfil?.equipe_nome ?? '',
                lider_nome:  item.lider_nome ?? liderPerfil?.nome ?? '',
                data:        item.data,
                turno:       item.turno,
                status:      'aberto',
              })
              router.replace('/(tabs)')
            },
          },
        ]
      )
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={turnos}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} colors={[C.primary]} />
        }
        ListHeaderComponent={
          <Text style={h.heading}>Últimos 60 dias · {turnos.length} turno{turnos.length !== 1 ? 's' : ''}</Text>
        }
        ListEmptyComponent={
          <View style={h.empty}>
            <Ionicons name="calendar-outline" size={52} color={C.textMuted} />
            <Text style={h.emptyTitle}>Nenhum turno encontrado</Text>
            <Text style={h.emptySub}>Os turnos dos últimos 60 dias aparecem aqui.</Text>
          </View>
        }
        renderItem={({ item }) => <TurnoCard item={item} onPress={() => handlePress(item)} />}
      />
    </View>
  )
}

const h = StyleSheet.create({
  heading:    { fontSize: 14, fontWeight: '600', color: C.textSub, marginBottom: 14 },
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: C.textSub, textAlign: 'center' },
})
