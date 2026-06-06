// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, fmtDate } from '../../src/lib/theme'

const STATUS_MAP = {
  rascunho:             { label: 'Rascunho',          color: C.textMuted, icon: 'create-outline',         bg: C.bgMuted },
  aguardando_aprovacao: { label: 'Aguardando',         color: '#F59E0B',   icon: 'time-outline',            bg: '#FEF9C3' },
  aprovado:             { label: 'Aprovado',           color: C.primary,   icon: 'checkmark-circle-outline',bg: C.greenBg },
  reprovado:            { label: 'Reprovado',          color: C.red,       icon: 'close-circle-outline',    bg: '#FEE2E2' },
  enviado_restaurante:  { label: 'No restaurante',     color: '#8B5CF6',   icon: 'restaurant-outline',      bg: '#EDE9FE' },
  confirmado:           { label: 'Confirmado',         color: C.primary,   icon: 'checkmark-done-outline',  bg: C.greenBg },
  entregue:             { label: 'Entregue',           color: C.primaryDark,icon: 'bag-check-outline',      bg: C.greenBg },
  cancelado:            { label: 'Cancelado',          color: C.red,       icon: 'ban-outline',             bg: '#FEE2E2' },
}

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || { label: status, color: C.textMuted, icon: 'help-circle-outline', bg: C.bgMuted }
  return (
    <View style={[st.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={[st.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

function SolCard({ sol }) {
  return (
    <View style={st.card}>
      <View style={st.cardHeader}>
        <Text style={st.numeroPedido}>{sol.numero_pedido || '—'}</Text>
        <StatusBadge status={sol.status} />
      </View>
      <View style={st.cardRow}>
        <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
        <Text style={st.cardSub}>{fmtDate(sol.data_refeicao)}</Text>
        <Text style={st.dot}>·</Text>
        <Ionicons name="restaurant-outline" size={13} color={C.textMuted} />
        <Text style={st.cardSub}>{sol.restaurante_nome || '—'}</Text>
      </View>
      <View style={st.cardRow}>
        <Text style={st.cardChip}>
          {'🍽️ ' + (sol.total_refeicoes || 0) + '  ☕ ' + (sol.total_cafes || 0)}
        </Text>
        {sol.valor_total > 0 && (
          <Text style={[st.cardChip, { color: C.primary, fontWeight: '700' }]}>
            {fmtBRL(sol.valor_total)}
          </Text>
        )}
      </View>
      {sol.observacoes ? (
        <Text style={st.obs} numberOfLines={1}>{'Obs: ' + sol.observacoes}</Text>
      ) : null}
      {sol.motivo_reprovacao ? (
        <Text style={st.motivo}>{'Motivo: ' + sol.motivo_reprovacao}</Text>
      ) : null}
    </View>
  )
}

export default function RefeicaoHistoricoScreen() {
  const nav         = useNavigation()
  const router      = useRouter()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)

  const [solicitacoes, setSols]      = useState([])
  const [loading,      setLoading]   = useState(true)
  const [refreshing,   setRefreshing]= useState(false)
  const [filtro,       setFiltro]    = useState('todos')
  const [avalPendente, setAvalPend]  = useState<any>(null)

  const filtros = [
    { key: 'todos',               label: 'Todas' },
    { key: 'aguardando_aprovacao',label: 'Aguardando' },
    { key: 'aprovado',            label: 'Aprovados' },
    { key: 'reprovado',           label: 'Reprovados' },
    { key: 'entregue',            label: 'Entregues' },
  ]

  const carregar = useCallback(async (isRefresh = false) => {
    if (!turnoAtivo) { setLoading(false); return }
    if (isRefresh) setRefreshing(true); else setLoading(true)

    let query = supabase
      .from('refei_solicitacoes')
      .select(`
        id, numero_pedido, status, data_refeicao, total_refeicoes,
        total_cafes, valor_total, observacoes, motivo_reprovacao, created_at,
        refei_restaurantes ( nome )
      `)
      .eq('workspace_id', workspaceId)
      .eq('equipe_id', turnoAtivo.equipe_id)
      .order('created_at', { ascending: false })
      .limit(60)

    const { data } = await query
    const lista = (data || []).map(s => ({
      ...s,
      restaurante_nome: s.refei_restaurantes?.nome || '—',
    }))
    setSols(lista)
    setLoading(false)
    setRefreshing(false)
  }, [turnoAtivo?.equipe_id, workspaceId])

  useEffect(() => {
    nav.setOptions({ title: 'Historico de Refeicoes' })
    carregar()

    // Verifica avaliação de qualidade pendente
    ;(async () => {
      try {
        const { data: userResp } = await supabase.auth.getUser()
        const userId = userResp.user?.id
        if (userId && workspaceId) {
          const today = new Date().toISOString().slice(0, 10)
          const { data: aval } = await supabase
            .from('refei_avaliacoes')
            .select('id, numero_pedido, restaurante_nome, data_refeicao')
            .eq('workspace_id', workspaceId)
            .eq('lider_id', userId)
            .eq('status', 'pendente')
            .lte('disponivel_em', today)
            .order('data_refeicao', { ascending: false })
            .limit(1)
            .maybeSingle()
          setAvalPend(aval || null)
        }
      } catch (_) {}
    })()

    // Realtime: atualiza ao mudar status
    const channel = supabase
      .channel('refei-historico')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'refei_solicitacoes', filter: `equipe_id=eq.${turnoAtivo?.equipe_id}` },
        () => carregar(true)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const lista = filtro === 'todos' ? solicitacoes : solicitacoes.filter(s => s.status === filtro)

  if (!turnoAtivo) {
    return (
      <View style={st.center}>
        <Ionicons name="alert-circle-outline" size={40} color={C.textMuted} />
        <Text style={{ color: C.textMuted, marginTop: 12 }}>Nenhum turno ativo</Text>
      </View>
    )
  }

  return (
    <View style={st.root}>
      {/* Banner de avaliação pendente */}
      {avalPendente && (
        <TouchableOpacity
          style={st.avalBanner}
          onPress={() => router.push({
            pathname: '/solicitacao/avaliacao-refeicao',
            params: {
              id:          avalPendente.id,
              numero:      avalPendente.numero_pedido   || '',
              restaurante: avalPendente.restaurante_nome || '',
              data:        avalPendente.data_refeicao   || '',
              obrigatorio: '0',
            },
          })}
          activeOpacity={0.85}>
          <View style={st.avalBannerLeft}>
            <Ionicons name="star-half-outline" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.avalBannerTitle}>Avaliação pendente</Text>
            <Text style={st.avalBannerSub}>
              {avalPendente.numero_pedido ? `Pedido ${avalPendente.numero_pedido} aguarda sua avaliação` : 'Avalie a refeição recebida'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}
      <FlatList
        data={filtros}
        horizontal
        keyExtractor={i => i.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.filtrosBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[st.filtroBtn, filtro === item.key && st.filtroBtnActive]}
            onPress={() => setFiltro(item.key)}
            activeOpacity={0.7}
          >
            <Text style={[st.filtroText, filtro === item.key && st.filtroTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading
        ? <View style={st.center}><ActivityIndicator color={C.primary} size="large" /></View>
        : (
          <FlatList
            data={lista}
            keyExtractor={i => i.id}
            contentContainerStyle={st.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => carregar(true)}
                tintColor={C.primary}
              />
            }
            ListEmptyComponent={
              <View style={st.empty}>
                <Ionicons name="receipt-outline" size={48} color={C.textMuted} />
                <Text style={st.emptyText}>Nenhuma solicitacao encontrada</Text>
              </View>
            }
            renderItem={({ item }) => <SolCard sol={item} />}
          />
        )
      }
    </View>
  )
}

const st = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.bg },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filtrosBar:      { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filtroBtn:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.bgCard },
  filtroBtnActive: { borderColor: C.primary, backgroundColor: C.greenBg },
  filtroText:      { fontSize: 13, fontWeight: '600', color: C.textSub },
  filtroTextActive:{ color: C.primaryDark },
  listContent:     { padding: 12, gap: 10 },
  card:            { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 6 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numeroPedido:    { fontSize: 15, fontWeight: '800', color: C.text },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:       { fontSize: 11, fontWeight: '700' },
  cardRow:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardSub:         { fontSize: 12, color: C.textSub },
  dot:             { color: C.textMuted, fontSize: 10 },
  cardChip:        { fontSize: 12, color: C.textSub, fontWeight: '600' },
  obs:             { fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
  motivo:          { fontSize: 12, color: C.red, fontWeight: '600' },
  empty:           { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:       { fontSize: 14, color: C.textMuted },

  avalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 12,
  },
  avalBannerLeft:  { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  avalBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  avalBannerSub:   { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
})
