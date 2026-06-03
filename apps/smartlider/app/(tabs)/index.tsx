// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { isClearlyOffline } from '../../src/lib/network'
import { C } from '../../src/lib/theme'

function fmtDateLong(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${Number(d)} de ${meses[Number(m)-1]} de ${y}`
}

interface DashData {
  presentes:             number
  total_colaboradores:   number
  maquinas_ativas:       number
  ha_realizado:          number
  ha_meta:               number
  refeicoes_solicitadas: number
}

const ACOES = [
  { icon: 'people-outline',           label: 'Mão de Obra',   sub: 'Apontar equipe',   route: '/apontamento/mao-de-obra'          },
  { icon: 'construct-outline',        label: 'Máquina',       sub: 'Apontar uso',      route: '/apontamento/maquina'              },
  { icon: 'flask-outline',            label: 'Insumo',        sub: 'Registrar uso',    route: '/apontamento/insumo'               },
  { icon: 'speedometer-outline',      label: 'Aferição',      sub: 'Registrar dados',  route: '/apontamento/afericao'             },
  { icon: 'restaurant-outline',       label: 'Refeição',      sub: 'Solicitar',        route: '/solicitacao/refeicao'             },
  { icon: 'cube-outline',             label: 'Sol. Insumo',   sub: 'Solicitar',        route: '/solicitacao/insumo'               },
  { icon: 'shield-checkmark-outline', label: 'EPI',           sub: 'Controlar',        route: '/solicitacao/epi'                  },
  { icon: 'analytics-outline',        label: 'Produtividade', sub: 'Acompanhar',       route: '/apontamento/produtividade-equipe' },
] as const

export default function DashboardScreen() {
  const router            = useRouter()
  const turnoAtivo        = useLiderStore(s => s.turnoAtivo)
  const workspaceId       = useLiderStore(s => s.workspaceId)
  const dashRefreshKey    = useLiderStore(s => s.dashRefreshKey)
  const turnoStats        = useLiderStore(s => s.turnoStats)
  const setTurnoStats     = useLiderStore(s => s.setTurnoStats)
  const [dados,   setDados]   = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(false)

  const carregar = useCallback(async (isRefresh = false) => {
    if (!turnoAtivo) return
    isRefresh ? setRefresh(true) : setLoading(true)

    // Se offline, usa cache do turnoStats
    if (!isRefresh && await isClearlyOffline()) {
      if (turnoStats) {
        setDados({
          presentes:             turnoStats.presentes            ?? 0,
          total_colaboradores:   turnoStats.total_colaboradores  ?? 0,
          maquinas_ativas:       turnoStats.maquinas             ?? 0,
          ha_realizado:          turnoStats.ha_realizado         ?? 0,
          ha_meta:               turnoStats.ha_meta              ?? 0,
          refeicoes_solicitadas: turnoStats.refeicoes            ?? 0,
        })
      }
      setLoading(false)
      return
    }

    try {
      const [
        { count: presentes },
        { count: total },
        { count: maquinas },
        { data: prodData },
        { count: refeicoes },
      ] = await Promise.all([
        supabase.from('lider_mao_obra').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id).eq('presente', true),
        supabase.from('lider_mao_obra').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
        supabase.from('lider_apontamentos_maquina').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
        supabase.from('lider_produtividade_equipe').select('realizado_ha, meta_ha').eq('turno_id', turnoAtivo.id),
        supabase.from('refei_solicitacoes').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('data_refeicao', turnoAtivo.data).neq('status', 'rascunho'),
      ])

      const ha_realizado = prodData?.reduce((s, r) => s + (r.realizado_ha ?? 0), 0) ?? 0
      const ha_meta      = prodData?.reduce((s, r) => s + (r.meta_ha      ?? 0), 0) ?? 0

      const novosDados = {
        presentes:             presentes ?? 0,
        total_colaboradores:   total     ?? 0,
        maquinas_ativas:       maquinas  ?? 0,
        ha_realizado,
        ha_meta,
        refeicoes_solicitadas: refeicoes ?? 0,
      }
      setDados(novosDados)
      // Persiste no store para uso offline futuro
      setTurnoStats({
        presentes:           novosDados.presentes,
        total_colaboradores: novosDados.total_colaboradores,
        maquinas:            novosDados.maquinas_ativas,
        ha_realizado:        novosDados.ha_realizado,
        ha_meta:             novosDados.ha_meta,
        refeicoes:           novosDados.refeicoes_solicitadas,
        epis_pendentes:      0,
        solicitacoes:        0,
        afericoes_reprovadas: 0,
        epis_vencendo:        0,
        avaliacao_media:      0,
        insumos_divergentes:  0,
        updatedAt:            new Date().toISOString(),
      })
    } catch {
      setDados({ presentes: 0, total_colaboradores: 0, maquinas_ativas: 0, ha_realizado: 0, ha_meta: 0, refeicoes_solicitadas: 0 })
    } finally {
      isRefresh ? setRefresh(false) : setLoading(false)
    }
  }, [turnoAtivo?.id, workspaceId])

  useEffect(() => { carregar() }, [carregar, dashRefreshKey])

  const efic = dados?.ha_meta ? Math.round((dados.ha_realizado / dados.ha_meta) * 100) : 0

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => carregar(true)} colors={[C.primary]} />}
    >
      {/* Resumo de Hoje */}
      <View style={st.sectionHeader}>
        <View style={st.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={18} color={C.primary} />
          <Text style={st.sectionTitle}>Resumo de Hoje</Text>
        </View>
        <View style={st.dateChip}>
          <Ionicons name="calendar-outline" size={12} color={C.textSub} />
          <Text style={st.sectionDate}>{turnoAtivo ? fmtDateLong(turnoAtivo.data) : ''}</Text>
        </View>
      </View>

      {loading
        ? <View style={st.loadingWrap}><ActivityIndicator color={C.primary} size="large" /></View>
        : (
          <View style={st.kpiGrid}>
            <KpiCard icon="people"     label="Presença"  value={`${dados?.presentes ?? 0}/${dados?.total_colaboradores ?? 0}`} sub="colaboradores" color={C.green}   iconBg={C.greenBg}  pct={dados?.total_colaboradores ? (dados.presentes / dados.total_colaboradores) * 100 : 0} />
            <KpiCard icon="construct"  label="Máquinas"  value={String(dados?.maquinas_ativas ?? 0)}                           sub="em operação"  color={C.blue}    iconBg={C.blueBg}   pct={null} />
            <KpiCard icon="leaf"       label="Área (ha)" value={`${dados?.ha_realizado}/${dados?.ha_meta}`}                     sub={`${efic}% da meta`} color={efic >= 100 ? C.green : efic >= 70 ? C.yellow : C.red} iconBg={C.greenBg} pct={efic} />
            <KpiCard icon="restaurant" label="Refeições" value={String(dados?.refeicoes_solicitadas ?? 0)}                     sub="solicitadas"  color="#F97316"   iconBg="#FFEDD5"    pct={null} />
          </View>
        )
      }

      {/* Ações Rápidas */}
      <View style={st.sectionTitleRow2}>
        <Ionicons name="flash" size={16} color="#F59E0B" />
        <Text style={st.sectionTitle}>Ações Rápidas</Text>
      </View>
      <View style={st.acoeGrid}>
        {ACOES.map(a => (
          <TouchableOpacity key={a.route} style={st.acaoCard} onPress={() => router.push(a.route as any)} activeOpacity={0.8}>
            <View style={st.acaoIcon}>
              <Ionicons name={a.icon as any} size={22} color={C.primaryDark} />
            </View>
            <Text style={st.acaoLabel}>{a.label}</Text>
            <Text style={st.acaoSub}>{a.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fechamento do Dia */}
      <View style={st.fecharCard}>
        <View style={st.fecharIconWrap}>
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
        </View>
        <View style={st.fecharInfo}>
          <Text style={st.fecharTitle}>Fechamento do Dia</Text>
          <Text style={st.fecharSub}>Revise os apontamentos antes de finalizar.</Text>
        </View>
        <TouchableOpacity style={st.fecharBtn} onPress={() => router.push('/fechamento' as any)} activeOpacity={0.85}>
          <Text style={st.fecharBtnTxt}>Fechar Dia</Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  )
}

function KpiCard({ icon, label, value, sub, color, iconBg, pct }: {
  icon: string; label: string; value: string; sub: string
  color: string; iconBg: string; pct: number | null
}) {
  return (
    <View style={st.kpiCard}>
      <View style={st.kpiTop}>
        <View style={[st.kpiIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={st.kpiLabel}>{label}</Text>
      </View>
      <Text style={st.kpiValue}>{value}</Text>
      <Text style={st.kpiSub}>{sub}</Text>
      {pct !== null && (
        <View style={st.barBg}>
          <View style={[st.barFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
        </View>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingTop: 20, paddingBottom: 120 },

  // Section headers
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitleRow2: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 12 },
  sectionTitle:     { fontSize: 15, fontWeight: '800', color: C.text },
  dateChip:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionDate:      { fontSize: 12, fontWeight: '500', color: C.textSub },

  // KPI
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  kpiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  kpiCard:     { flex: 1, minWidth: '44%', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kpiIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  kpiLabel:    { fontSize: 12.5, color: C.textSub, fontWeight: '600', flex: 1 },
  kpiValue:    { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 2 },
  kpiSub:      { fontSize: 11, color: C.textMuted, marginBottom: 8 },
  barBg:       { height: 5, backgroundColor: C.border, borderRadius: 3 },
  barFill:     { height: 5, borderRadius: 3 },

  // Ações Rápidas
  acoeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  acaoCard:  { width: '22%', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  acaoIcon:  { width: 46, height: 46, borderRadius: 13, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center', marginBottom: 7 },
  acaoLabel: { fontSize: 10, color: C.text, textAlign: 'center', fontWeight: '700', marginBottom: 2 },
  acaoSub:   { fontSize: 9, color: C.textMuted, textAlign: 'center', fontWeight: '500' },

  // Fechamento do Dia
  fecharCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  fecharIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  fecharInfo:     { flex: 1 },
  fecharTitle:    { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 3 },
  fecharSub:      { fontSize: 11, color: C.textMuted, lineHeight: 15 },
  fecharBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, gap: 4, flexShrink: 0 },
  fecharBtnTxt:   { fontSize: 13, fontWeight: '700', color: '#fff' },
})
