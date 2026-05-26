import { useEffect, useRef, useState } from 'react'
import {
  Animated, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Platform, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { C, TURNO_LABEL, fmtDate } from '../lib/theme'
import useLiderStore from '../store/useLiderStore'
import type { TurnoAtivo } from '../store/useLiderStore'

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.88, 340)

interface Props {
  visible:    boolean
  onClose:    () => void
  turnoAtivo: TurnoAtivo
}

export default function RightDrawer({ visible, onClose, turnoAtivo }: Props) {
  const translateX    = useRef(new Animated.Value(DRAWER_WIDTH)).current
  const turnoStats    = useLiderStore(s => s.turnoStats)
  const setTurnoStats = useLiderStore(s => s.setTurnoStats)
  const [refreshing, setRefreshing] = useState(false)

  // data vem do cache local (AsyncStorage) — funciona offline
  const data = turnoStats

  /* Animação de entrada/saída */
  useEffect(() => {
    Animated.spring(translateX, {
      toValue:         visible ? 0 : DRAWER_WIDTH,
      useNativeDriver: true,
      tension:         70,
      friction:        12,
    }).start()
    // Ao abrir: tenta atualizar do servidor em background (não bloqueia)
    if (visible) atualizarDoServidor()
  }, [visible])

  async function atualizarDoServidor() {
    setRefreshing(true)
    try {
      const tid = turnoAtivo.id
      const [
        { count: presentes },
        { count: total },
        { count: maquinas },
        { data: prodData },
        { count: refeicoes },
        { count: epis },
        { count: solicitacoes },
        { count: afericoes_reprovadas },
        { count: epis_vencendo },
        { data: avaliacoes },
        { count: insumos_divergentes },
      ] = await Promise.all([
        supabase.from('lider_mao_obra').select('*', { count: 'exact', head: true }).eq('turno_id', tid).eq('presente', true),
        supabase.from('lider_mao_obra').select('*', { count: 'exact', head: true }).eq('turno_id', tid),
        supabase.from('lider_apontamentos_maquina').select('*', { count: 'exact', head: true }).eq('turno_id', tid),
        supabase.from('lider_produtividade_equipe').select('realizado_ha, meta_ha').eq('turno_id', tid),
        supabase.from('lider_solicitacoes_refeicao').select('*', { count: 'exact', head: true }).eq('turno_id', tid),
        supabase.from('lider_solicitacoes_epi').select('*', { count: 'exact', head: true }).eq('turno_id', tid).eq('status', 'pendente'),
        supabase.from('lider_solicitacoes_insumo').select('*', { count: 'exact', head: true }).eq('turno_id', tid).eq('status', 'pendente'),
        supabase.from('lider_afericoes').select('*', { count: 'exact', head: true }).eq('turno_id', tid).eq('status', 'reprovado'),
        supabase.from('lider_controle_epi').select('*', { count: 'exact', head: true }).eq('turno_id', tid).in('status', ['vencendo', 'vencido']),
        supabase.from('lider_avaliacoes_equipe').select('nota_geral').eq('turno_id', tid),
        supabase.from('lider_apontamentos_insumo').select('*', { count: 'exact', head: true }).eq('turno_id', tid).eq('status', 'divergente'),
      ])

      const ha_realizado    = prodData?.reduce((s, r) => s + (r.realizado_ha ?? 0), 0) ?? 0
      const ha_meta         = prodData?.reduce((s, r) => s + (r.meta_ha      ?? 0), 0) ?? 0
      const avaliacao_media = avaliacoes?.length
        ? Math.round((avaliacoes.reduce((s, r) => s + (r.nota_geral ?? 0), 0) / avaliacoes.length) * 10) / 10
        : 0

      setTurnoStats({
        presentes:            presentes  ?? 0,
        total_colaboradores:  total      ?? 0,
        maquinas:             maquinas   ?? 0,
        ha_realizado,
        ha_meta,
        refeicoes:            refeicoes  ?? 0,
        epis_pendentes:       epis       ?? 0,
        solicitacoes:         solicitacoes ?? 0,
        afericoes_reprovadas: afericoes_reprovadas ?? 0,
        epis_vencendo:        epis_vencendo ?? 0,
        avaliacao_media,
        insumos_divergentes:  insumos_divergentes ?? 0,
        updatedAt:            new Date().toISOString(),
      })
    } catch {
      // sem rede — mantém cache local
    } finally {
      setRefreshing(false)
    }
  }

  const efic    = data?.ha_meta ? Math.round((data.ha_realizado / data.ha_meta) * 100) : 0
  const eficCor = efic >= 100 ? C.drawerGreen : efic >= 70 ? C.drawerYellow : C.drawerRed

  // Formata quando foi atualizado
  function fmtUpdated(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  return (
    <>
      {/* Overlay escuro */}
      {visible && (
        <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1} />
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        {/* Cabeçalho escuro */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Resumo do Turno</Text>
            <Text style={styles.headerSub}>{fmtDate(turnoAtivo.data)}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={C.drawerTextSub} />
          </TouchableOpacity>
        </View>

        {/* Info do turno */}        <View style={styles.turnoCard}>
          <View style={styles.turnoRow}>
            <View style={styles.statusDot} />
            <Text style={styles.turnoFrente}>{turnoAtivo.frente_nome}</Text>
            <View style={styles.turnoBadge}>
              <Text style={styles.turnoBadgeText}>{TURNO_LABEL[turnoAtivo.turno]}</Text>
            </View>
          </View>
          <Text style={styles.turnoEquipe}>Equipe {turnoAtivo.equipe_nome}</Text>
          <Text style={styles.turnoLider}>👤 {turnoAtivo.lider_nome}</Text>
        </View>

        {/* Divisor */}
        <View style={styles.divider} />

        {/* Indicador de atualização */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 }}>
          {refreshing
            ? <ActivityIndicator size="small" color={C.drawerGreen} style={{ marginRight: 6 }} />
            : <Ionicons name="checkmark-circle" size={14} color={data ? C.drawerGreen : C.drawerTextSub} style={{ marginRight: 6 }} />
          }
          <Text style={{ fontSize: 11, color: C.drawerTextSub }}>
            {refreshing
              ? 'Atualizando...'
              : data?.updatedAt
                ? `Atualizado às ${fmtUpdated(data.updatedAt)}`
                : 'Sem dados (offline)'}
          </Text>
        </View>

        {!data
          ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="cloud-offline-outline" size={40} color={C.drawerTextSub} />
              <Text style={{ color: C.drawerTextSub, marginTop: 12, fontSize: 13 }}>Sem dados disponíveis</Text>
              <Text style={{ color: C.drawerTextSub, fontSize: 11, marginTop: 4 }}>Conecte-se para carregar</Text>
            </View>
          )
          : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <DrawerSection titulo="Operacional">
                <DrawerRow
                  icon="people"
                  label="Mao de Obra"
                  value={`${data?.presentes ?? 0}/${data?.total_colaboradores ?? 0}`}
                  sub="presentes"
                  color={
                    !data?.total_colaboradores ? C.drawerTextSub
                    : data.presentes === data.total_colaboradores ? C.drawerGreen
                    : C.drawerYellow
                  }
                />
                <DrawerRow
                  icon="construct"
                  label="Maquinas"
                  value={String(data?.maquinas ?? 0)}
                  sub="em operacao"
                  color={C.drawerGreen}
                />
                <DrawerRow
                  icon="leaf"
                  label="Produtividade"
                  value={`${data?.ha_realizado ?? 0} ha`}
                  sub={data?.ha_meta ? `${efic}% da meta (${data.ha_meta} ha)` : 'sem meta'}
                  color={eficCor}
                />
                <DrawerRow
                  icon="beaker"
                  label="Afericoes reprovadas"
                  value={String(data?.afericoes_reprovadas ?? 0)}
                  sub="requer ajuste"
                  color={data?.afericoes_reprovadas ? C.drawerRed : C.drawerGreen}
                />
                <DrawerRow
                  icon="star"
                  label="Avaliacao equipe"
                  value={data?.avaliacao_media ? String(data.avaliacao_media) : '-'}
                  sub="nota media"
                  color={data?.avaliacao_media >= 4 ? C.drawerGreen : data?.avaliacao_media >= 3 ? C.drawerYellow : C.drawerRed}
                />
              </DrawerSection>

              <DrawerSection titulo="Solicitacoes">
                <DrawerRow
                  icon="restaurant"
                  label="Refeicoes"
                  value={String(data?.refeicoes ?? 0)}
                  sub="solicitadas"
                  color={C.drawerGreen}
                />
                <DrawerRow
                  icon="shield-checkmark"
                  label="EPIs pendentes"
                  value={String(data?.epis_pendentes ?? 0)}
                  sub="aguardando aprovacao"
                  color={data?.epis_pendentes ? C.drawerYellow : C.drawerGreen}
                />
                <DrawerRow
                  icon="warning"
                  label="EPIs vencendo"
                  value={String(data?.epis_vencendo ?? 0)}
                  sub="vencidos ou vencendo"
                  color={data?.epis_vencendo ? C.drawerRed : C.drawerGreen}
                />
                <DrawerRow
                  icon="cube"
                  label="Insumos pendentes"
                  value={String(data?.solicitacoes ?? 0)}
                  sub="aguardando aprovacao"
                  color={data?.solicitacoes ? C.drawerYellow : C.drawerGreen}
                />
                <DrawerRow
                  icon="alert-circle"
                  label="Insumos divergentes"
                  value={String(data?.insumos_divergentes ?? 0)}
                  sub="requer verificacao"
                  color={data?.insumos_divergentes ? C.drawerRed : C.drawerGreen}
                />
              </DrawerSection>

              {/* Barra de eficiência */}
              {(data?.ha_meta ?? 0) > 0 && (
                <View style={styles.eficSection}>
                  <View style={styles.eficHeader}>
                    <Text style={styles.eficLabel}>Eficiência geral</Text>
                    <Text style={[styles.eficPct, { color: eficCor }]}>{efic}%</Text>
                  </View>
                  <View style={styles.eficBar}>
                    <View style={[styles.eficFill, { width: `${Math.min(efic, 100)}%` as any, backgroundColor: eficCor }]} />
                  </View>
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          )
        }
      </Animated.View>
    </>
  )
}

/* ── Sub-componentes ─────────────────────────────────────────── */

function DrawerSection({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{titulo.toUpperCase()}</Text>
      {children}
    </View>
  )
}

function DrawerRow({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string; color: string
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  )
}

/* ── Estilos ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 99,
  },
  drawer: {
    position:        'absolute',
    top:             0,
    right:           0,
    bottom:          0,
    width:           DRAWER_WIDTH,
    backgroundColor: C.drawerBg,
    zIndex:          100,
    shadowColor:     '#000',
    shadowOffset:    { width: -6, height: 0 },
    shadowOpacity:   0.45,
    shadowRadius:    16,
    elevation:       24,
  },

  /* Header */
  header: {
    backgroundColor: C.drawerCard,
    flexDirection:   'row',
    alignItems:      'flex-start',
    paddingHorizontal: 18,
    paddingTop:      Platform.OS === 'ios' ? 58 : 42,
    paddingBottom:   16,
    borderBottomWidth: 1,
    borderBottomColor: C.drawerBorder,
  },
  headerTitle: { color: C.drawerText,    fontSize: 16, fontWeight: '700' },
  headerSub:   { color: C.drawerTextSub, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    8,
    backgroundColor: C.drawerBorder,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       2,
  },

  /* Turno card */
  turnoCard: {
    backgroundColor: C.drawerCard,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.drawerBorder,
  },
  turnoRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.drawerGreen, marginRight: 8 },
  turnoFrente:    { color: C.drawerText, fontSize: 15, fontWeight: '700', flex: 1 },
  turnoBadge:     { backgroundColor: C.drawerGreen + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  turnoBadgeText: { color: C.drawerGreen, fontSize: 11, fontWeight: '700' },
  turnoEquipe:    { color: C.drawerTextSub, fontSize: 12, marginBottom: 2 },
  turnoLider:     { color: C.drawerTextSub, fontSize: 12 },

  divider: { height: 1, backgroundColor: C.drawerBorder },

  /* Sections */
  scroll:       { flex: 1 },
  section:      { paddingTop: 16, paddingBottom: 4 },
  sectionTitle: {
    color:           C.drawerTextSub,
    fontSize:        10,
    fontWeight:      '700',
    letterSpacing:   1.2,
    paddingHorizontal: 18,
    marginBottom:    8,
  },

  /* Rows */
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.drawerBorder + '80',
  },
  rowIcon:  { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowText:  { flex: 1 },
  rowLabel: { color: C.drawerText, fontSize: 13, fontWeight: '600' },
  rowSub:   { color: C.drawerTextSub, fontSize: 11, marginTop: 1 },
  rowValue: { fontSize: 17, fontWeight: '700' },

  /* Eficiência */
  eficSection: {
    marginHorizontal: 18,
    marginTop:        16,
    padding:          14,
    backgroundColor:  C.drawerCard,
    borderRadius:     10,
    borderWidth:      1,
    borderColor:      C.drawerBorder,
  },
  eficHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  eficLabel:  { color: C.drawerTextSub, fontSize: 12, fontWeight: '600' },
  eficPct:    { fontSize: 14, fontWeight: '700' },
  eficBar:    { height: 6, backgroundColor: C.drawerBorder, borderRadius: 3, overflow: 'hidden' },
  eficFill:   { height: '100%', borderRadius: 3 },
})
