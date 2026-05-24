import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, RefreshControl, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, fmtDate } from '../../src/lib/theme'

interface DashData {
  presentes: number
  total_colaboradores: number
  maquinas_ativas: number
  ha_realizado: number
  ha_meta: number
  insumos_aplicados: number
  refeicoes_solicitadas: number
  pendencias: number
}

const ACOES = [
  { icon: 'people-outline',      label: 'Mão de Obra',       route: '/apontamento/mao-de-obra'     as const },
  { icon: 'construct-outline',   label: 'Máquina',           route: '/apontamento/maquina'          as const },
  { icon: 'flask-outline',       label: 'Insumo',            route: '/apontamento/insumo'           as const },
  { icon: 'speedometer-outline', label: 'Aferição',          route: '/apontamento/afericao'         as const },
  { icon: 'restaurant-outline',  label: 'Refeição',          route: '/solicitacao/refeicao'         as const },
  { icon: 'cube-outline',        label: 'Sol. Insumo',       route: '/solicitacao/insumo'           as const },
  { icon: 'shield-checkmark-outline', label: 'EPI',         route: '/solicitacao/epi'              as const },
  { icon: 'analytics-outline',   label: 'Produtividade',     route: '/apontamento/produtividade-equipe' as const },
] as const

export default function DashboardScreen() {
  const router     = useRouter()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)
  const [dados,    setDados]     = useState<DashData | null>(null)
  const [loading,  setLoading]   = useState(true)
  const [refresh,  setRefresh]   = useState(false)

  const carregar = useCallback(async (isRefresh = false) => {
    if (!turnoAtivo) return
    isRefresh ? setRefresh(true) : setLoading(true)

    // Conta mão de obra
    const [{ count: presentes }, { count: total }, { count: maquinas }, { data: prodData }] = await Promise.all([
      supabase.from('lider_mao_obra').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id).eq('presente', true),
      supabase.from('lider_mao_obra').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
      supabase.from('lider_apontamentos_maquina').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
      supabase.from('lider_produtividade_equipe').select('realizado_ha, meta_ha').eq('turno_id', turnoAtivo.id),
    ])

    const ha_realizado = prodData?.reduce((s, r) => s + (r.realizado_ha ?? 0), 0) ?? 0
    const ha_meta      = prodData?.reduce((s, r) => s + (r.meta_ha      ?? 0), 0) ?? 0

    setDados({
      presentes:              presentes ?? 0,
      total_colaboradores:    total     ?? 0,
      maquinas_ativas:        maquinas  ?? 0,
      ha_realizado,
      ha_meta,
      insumos_aplicados:      0,
      refeicoes_solicitadas:  0,
      pendencias:             0,
    })
    isRefresh ? setRefresh(false) : setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  const efic = dados?.ha_meta ? Math.round((dados.ha_realizado / dados.ha_meta) * 100) : 0

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => carregar(true)} colors={[C.primary]} />}
    >
      {/* KPI Cards */}
      {loading
        ? <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} size="large" />
        : (
          <View style={styles.grid}>
            <KpiCard icon="people" label="Presença" value={`${dados?.presentes ?? 0}/${dados?.total_colaboradores ?? 0}`} sub="colaboradores" color={C.green}  pct={dados?.total_colaboradores ? (dados.presentes / dados.total_colaboradores) * 100 : 0} />
            <KpiCard icon="construct" label="Máquinas" value={String(dados?.maquinas_ativas ?? 0)} sub="em operação" color={C.blue}   pct={null} />
            <KpiCard icon="leaf" label="Área (ha)" value={`${dados?.ha_realizado}/${dados?.ha_meta}`} sub={`${efic}% da meta`} color={efic >= 100 ? C.green : efic >= 70 ? C.yellow : C.red} pct={efic} />
            <KpiCard icon="restaurant" label="Refeições" value={String(dados?.refeicoes_solicitadas ?? 0)} sub="solicitadas" color={C.yellow} pct={null} />
          </View>
        )
      }

      {/* Ações Rápidas */}
      <Text style={styles.sectionTitle}>Ações Rápidas</Text>
      <View style={styles.acoeGrid}>
        {ACOES.map(a => (
          <TouchableOpacity key={a.route} style={styles.acaoCard} onPress={() => router.push(a.route as any)} activeOpacity={0.8}>
            <View style={styles.acaoIcon}>
              <Ionicons name={a.icon as any} size={24} color={C.primary} />
            </View>
            <Text style={styles.acaoLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fechar Dia */}
      <TouchableOpacity style={styles.fecharBtn} onPress={() => router.push('/fechamento' as any)} activeOpacity={0.85}>
        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.fecharBtnText}>Fechar Dia</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

function KpiCard({ icon, label, value, sub, color, pct }: {
  icon: string; label: string; value: string; sub: string; color: string; pct: number | null
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={[styles.kpiIconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
      {pct !== null && (
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  scroll:       { padding: 16 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  kpiCard:      { flex: 1, minWidth: '45%', backgroundColor: C.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  kpiIconWrap:  { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  kpiLabel:     { fontSize: 12, color: C.textSub, fontWeight: '600' },
  kpiValue:     { fontSize: 22, fontWeight: '800', color: C.text },
  kpiSub:       { fontSize: 11, color: C.textMuted, marginBottom: 8 },
  barBg:        { height: 4, backgroundColor: C.border, borderRadius: 2 },
  barFill:      { height: 4, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  acoeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  acaoCard:     { width: '22%', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  acaoIcon:     { width: 44, height: 44, borderRadius: 12, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  acaoLabel:    { fontSize: 9.5, color: C.text, textAlign: 'center', fontWeight: '600' },
  fecharBtn:    { backgroundColor: C.navy, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fecharBtnText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
})
