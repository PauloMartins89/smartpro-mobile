// @ts-nocheck
import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, fmtDate } from '../../src/lib/theme'

// ── Status ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pendente:             { label: 'Pendente',    color: C.yellowText, bg: C.yellowBg, icon: 'time-outline'             },
  aprovado:             { label: 'Aprovado',    color: C.greenText,  bg: C.greenBg,  icon: 'checkmark-circle-outline' },
  reprovado:            { label: 'Reprovado',   color: C.redText,    bg: C.redBg,    icon: 'close-circle-outline'     },
  entregue:             { label: 'Entregue',    color: C.greenText,  bg: C.greenBg,  icon: 'bag-check-outline'        },
  aguardando_aprovacao: { label: 'Aguardando',  color: C.yellowText, bg: C.yellowBg, icon: 'time-outline'             },
  enviado_restaurante:  { label: 'Restaurante', color: C.purpleText, bg: C.purpleBg, icon: 'restaurant-outline'       },
  confirmado:           { label: 'Confirmado',  color: C.greenText,  bg: C.greenBg,  icon: 'checkmark-done-outline'   },
  cancelado:            { label: 'Cancelado',   color: C.redText,    bg: C.redBg,    icon: 'ban-outline'              },
}

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: C.textSub, bg: C.bgMuted, icon: 'help-circle-outline' }
  return (
    <View style={[sc.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
      <Text style={[sc.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}
const sc = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, gap: 4 },
  text:  { fontSize: 11, fontWeight: '700' },
})

const TIPO_ICON: Record<string, string> = {
  refeicao: 'restaurant-outline',
  insumo:   'cube-outline',
  epi:      'shield-checkmark-outline',
}

function SolCard({ item, onPress }) {
  return (
    <TouchableOpacity style={sol.card} onPress={onPress} activeOpacity={0.82}>
      <View style={sol.iconWrap}>
        <Ionicons name={TIPO_ICON[item._tipo] as any ?? 'receipt-outline'} size={18} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sol.titulo} numberOfLines={1}>{item._titulo}</Text>
        <Text style={sol.sub}>{fmtDate((item.created_at ?? item.solicitado_em ?? '').slice(0, 10))}</Text>
      </View>
      <StatusChip status={item.status} />
    </TouchableOpacity>
  )
}
const sol = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgMuted, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center' },
  titulo:   { fontSize: 13, fontWeight: '600', color: C.text },
  sub:      { fontSize: 11, color: C.textMuted, marginTop: 1 },
})

// ── Ações rápidas ──────────────────────────────────────────────────────────
const ACOES = [
  { icon: 'restaurant-outline',       label: 'Nova Refeição',  sub: 'Solicitar refeição para equipe',  route: '/solicitacao/refeicao' },
  { icon: 'cube-outline',             label: 'Novo Insumo',    sub: 'Solicitar insumos com urgência',  route: '/solicitacao/insumo' },
  { icon: 'shield-checkmark-outline', label: 'Novo EPI',       sub: 'Solicitar EPIs para colaborador', route: '/solicitacao/epi' },
  { icon: 'list-outline',             label: 'Histórico Ref.', sub: 'Ver todas as refeições e status', route: '/solicitacao/refeicao-historico' },
]

// ── Tela ───────────────────────────────────────────────────────────────────
export default function SolicitacoesScreen() {
  const router      = useRouter()
  const liderPerfil = useLiderStore(s => s.liderPerfil)
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)

  const [recentes,   setRecentes]   = useState<any[]>([])
  const [loadingSol, setLoadingSol] = useState(false)

  useFocusEffect(useCallback(() => {
    let active = true
    async function load() {
      if (!liderPerfil?.equipe_id) return
      setLoadingSol(true)
      try {
        const [resRef, resIns, resEpi] = await Promise.all([
          supabase.from('lider_solicitacoes_refeicao')
            .select('id, status, data_refeicao, tipo, created_at')
            .eq('equipe_id', liderPerfil.equipe_id)
            .order('created_at', { ascending: false }).limit(5),
          turnoAtivo?.id
            ? supabase.from('lider_solicitacoes_insumo')
                .select('id, status, produto_nome, urgencia, created_at')
                .eq('turno_id', turnoAtivo.id)
                .order('created_at', { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
          turnoAtivo?.id
            ? supabase.from('lider_solicitacoes_epi')
                .select('id, status, epi_nome, colaborador_nome, created_at')
                .eq('turno_id', turnoAtivo.id)
                .order('created_at', { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
        ])
        const merged = [
          ...(resRef.data ?? []).map(r => ({
            ...r, _tipo: 'refeicao',
            _titulo: ['Refeição', r.tipo, r.data_refeicao ? fmtDate(r.data_refeicao) : ''].filter(Boolean).join(' · '),
          })),
          ...(resIns.data ?? []).map(r => ({
            ...r, _tipo: 'insumo',
            _titulo: r.produto_nome + (r.urgencia === 'urgente' || r.urgencia === 'alta' ? ' ⚡' : ''),
          })),
          ...(resEpi.data ?? []).map(r => ({
            ...r, _tipo: 'epi',
            _titulo: `${r.epi_nome} · ${r.colaborador_nome}`,
          })),
        ].sort((a, b) => b.created_at > a.created_at ? 1 : -1).slice(0, 5)
        if (active) setRecentes(merged)
      } catch { /* sem conexão */ }
      finally { if (active) setLoadingSol(false) }
    }
    load()
    return () => { active = false }
  }, [liderPerfil?.equipe_id, turnoAtivo?.id]))

  const pendentes = recentes.filter(r => ['pendente', 'aguardando_aprovacao'].includes(r.status)).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Solicitações</Text>

      {/* ─── Recentes com status ─────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.secHeader}>
          <Text style={styles.secTitle}>Recentes</Text>
          {pendentes > 0 && (
            <View style={styles.pendBadge}>
              <Text style={styles.pendText}>{pendentes} aguardando</Text>
            </View>
          )}
          {loadingSol && <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 6 }} />}
        </View>
        {recentes.length === 0 && !loadingSol ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={26} color={C.textMuted} />
            <Text style={styles.emptyText}>Nenhuma solicitação recente</Text>
          </View>
        ) : recentes.map(item => (
          <SolCard
            key={item.id}
            item={item}
            onPress={() => {
              if (item._tipo === 'refeicao') router.push('/solicitacao/refeicao-historico')
              else if (item._tipo === 'insumo') router.push('/solicitacao/insumo')
              else if (item._tipo === 'epi') router.push('/solicitacao/epi')
            }}
          />
        ))}
      </View>

      {/* ─── Nova Solicitação ─────────────────────────────────────────── */}
      <Text style={styles.secTitle}>Nova Solicitação</Text>
      <View style={{ height: 10 }} />
      {ACOES.map(item => (
        <TouchableOpacity
          key={item.route}
          style={styles.card}
          onPress={() => router.push(item.route as any)}
          activeOpacity={0.8}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon as any} size={24} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardSub}>{item.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  title:      { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 18 },
  section:    { backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  secHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  secTitle:   { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  pendBadge:  { backgroundColor: C.yellowBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendText:   { fontSize: 12, fontWeight: '700', color: C.yellowText },
  emptyBox:   { alignItems: 'center', padding: 16, gap: 6 },
  emptyText:  { fontSize: 13, color: C.textMuted },
  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  iconWrap:   { width: 46, height: 46, borderRadius: 12, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardLabel:  { fontSize: 15, fontWeight: '700', color: C.text },
  cardSub:    { fontSize: 12, color: C.textSub, marginTop: 2 },
})
