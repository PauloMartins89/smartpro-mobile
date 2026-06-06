import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import useLiderStore from '../src/store/useLiderStore'
import useSyncStore from '../src/store/useSyncStore'
import { isClearlyOffline } from '../src/lib/network'
import { C, fmtDate, TURNO_LABEL } from '../src/lib/theme'

interface Resumo {
  presentes: number
  ausentes:  number
  maquinas:  number
  insumos:   number
  refeicoes: number
  ocorrencias: number
  avaliacao: number | null
  ha_realizado: number
  ha_meta:      number
}

export default function FechamentoScreen() {
  const router      = useRouter()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const setTurno    = useLiderStore(s => s.setTurnoAtivo)
  const turnoStats  = useLiderStore(s => s.turnoStats)
  const [resumo,   setResumo]  = useState<Resumo | null>(null)
  const [loading,  setLoading] = useState(true)
  const [fechando, setFechando]= useState(false)

  useEffect(() => {
    if (!turnoAtivo) return
    const workspaceId = useLiderStore.getState().workspaceId
    const base = new Date(turnoAtivo.data)
    const d0   = new Date(base); d0.setDate(d0.getDate() - 1)
    const d2   = new Date(base); d2.setDate(d2.getDate() + 1)
    const fmtD = (d: Date) => d.toISOString().slice(0, 10)

    Promise.all([
      supabase.from('lider_mao_obra').select('presente').eq('turno_id', turnoAtivo.id),
      supabase.from('lider_apontamentos_maquina').select('id', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
      supabase.from('lider_apontamentos_insumo').select('id', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
      supabase.from('lider_produtividade_equipe').select('realizado_ha, meta_ha').eq('turno_id', turnoAtivo.id),
      supabase.from('lider_avaliacoes_equipe').select('nota_geral').eq('turno_id', turnoAtivo.id).maybeSingle(),
      supabase.from('refei_solicitacoes').select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('data_refeicao', fmtD(d0))
        .lte('data_refeicao', fmtD(d2))
        .neq('status', 'rascunho'),
      supabase.from('lider_ocorrencias').select('*', { count: 'exact', head: true }).eq('turno_id', turnoAtivo.id),
    ]).then(([{ data: mo }, { count: maq }, { count: ins }, { data: prod }, { data: aval }, { count: refei }, { count: ocorr }]) => {
      setResumo({
        presentes:    (mo ?? []).filter(r => r.presente).length,
        ausentes:     (mo ?? []).filter(r => !r.presente).length,
        maquinas:     maq   ?? 0,
        insumos:      ins   ?? 0,
        refeicoes:    refei ?? 0,
        ocorrencias:  ocorr ?? 0,
        avaliacao:    aval?.nota_geral ?? null,
        ha_realizado: (prod ?? []).reduce((s, r) => s + (r.realizado_ha ?? 0), 0),
        ha_meta:      (prod ?? []).reduce((s, r) => s + (r.meta_ha      ?? 0), 0),
      })
      setLoading(false)
    }).catch(() => {
      // Offline: usa snapshot do store
      if (turnoStats) {
        setResumo({
          presentes:    turnoStats.presentes,
          ausentes:     turnoStats.total_colaboradores - turnoStats.presentes,
          maquinas:     turnoStats.maquinas,
          insumos:      useSyncStore.getState().queue.filter(r => r.table === 'lider_apontamentos_insumo' && r.payload.turno_id === turnoAtivo.id).length,
          refeicoes:    turnoStats.refeicoes,
          ocorrencias:  0,
          avaliacao:    turnoStats.avaliacao_media || null,
          ha_realizado: turnoStats.ha_realizado,
          ha_meta:      turnoStats.ha_meta,
        })
      }
      setLoading(false)
    })
  }, [turnoAtivo?.id])

  async function handleFechar() {
    if (!turnoAtivo) return
    Alert.alert(
      'Fechar o Turno?',
      'Após fechar, não será possível alterar os registros deste turno.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Fechar Turno', style: 'destructive', onPress: async () => {
          setFechando(true)

          // Offline: enfileira o fechamento
          if (await isClearlyOffline()) {
            useSyncStore.getState().addToQueue({
              id: turnoAtivo.id, table: 'lider_turnos', action: 'update',
              payload: { id: turnoAtivo.id, status: 'fechado', fechado_em: new Date().toISOString() },
              created_at: new Date().toISOString(),
            })
            setTurno(null)
            Alert.alert('Turno Fechado!', 'Será sincronizado quando a conexão voltar.')
            router.replace('/turno/novo')
            return
          }

          const { error } = await supabase.from('lider_turnos')
            .update({ status: 'fechado', fechado_em: new Date().toISOString() })
            .eq('id', turnoAtivo.id)

          if (error) { Alert.alert('Erro', error.message); setFechando(false); return }

          setTurno(null)
          Alert.alert('Turno Fechado!', 'Boletim gerado. Iniciando novo turno...')
          router.replace('/turno/novo')
        }},
      ]
    )
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  const efic = resumo?.ha_meta ? Math.round((resumo.ha_realizado / resumo.ha_meta) * 100) : 0

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Cabeçalho do turno */}
        <View style={styles.headerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
              style={{ marginRight: 10 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Resumo do Turno</Text>
          </View>
          <Text style={styles.headerSub}>
            {turnoAtivo?.frente_nome} · {TURNO_LABEL[turnoAtivo?.turno ?? 'manha']}
          </Text>
          <Text style={styles.headerData}>{fmtDate(turnoAtivo?.data ?? '')}</Text>
        </View>

        {/* Cards de resumo */}
        <View style={styles.grid}>
          <ResumoCard icon="people"     label="Presentes"   value={String(resumo?.presentes   ?? 0)} color={C.green}  />
          <ResumoCard icon="warning"    label="Ausentes"    value={String(resumo?.ausentes    ?? 0)} color={C.red}    />
          <ResumoCard icon="construct"  label="Máquinas"    value={String(resumo?.maquinas    ?? 0)} color={C.blue}   />
          <ResumoCard icon="flask"      label="Insumos"     value={String(resumo?.insumos     ?? 0)} color={C.yellow} />
          <ResumoCard icon="restaurant" label="Refeições"   value={String(resumo?.refeicoes   ?? 0)} color="#F97316" />
          <ResumoCard icon="warning-outline" label="Ocorrências" value={String(resumo?.ocorrencias ?? 0)} color={resumo?.ocorrencias ? C.red : C.textSub} />
        </View>

        {/* Produtividade */}
        <View style={styles.prodCard}>
          <Text style={styles.prodTitle}>Produtividade</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.prodLabel}>{Number(resumo?.ha_realizado ?? 0).toFixed(1)} ha realizados</Text>
            <Text style={[styles.prodLabel, { color: efic >= 100 ? C.greenText : efic >= 70 ? C.yellow : C.red }]}>{efic}%</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.min(efic, 100)}%`, backgroundColor: efic >= 100 ? C.green : efic >= 70 ? C.yellow : C.red }]} />
          </View>
          <Text style={styles.prodMeta}>Meta: {Number(resumo?.ha_meta ?? 0).toFixed(1)} ha</Text>
        </View>

        {/* Avaliação */}
        {resumo?.avaliacao !== null && (
          <View style={styles.avalCard}>
            <Ionicons name="star" size={18} color="#F59E0B" />
            <Text style={styles.avalText}>Nota da Equipe: <Text style={{ fontWeight: '800', color: C.text }}>{resumo?.avaliacao?.toFixed(1)}/5</Text></Text>
          </View>
        )}

        {/* Pendências */}
        {!resumo?.avaliacao && (
          <View style={styles.alertCard}>
            <Ionicons name="alert-circle-outline" size={18} color={C.yellow} />
            <Text style={styles.alertText}>Avaliação da equipe não realizada</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Botão fechar */}
      <View style={[styles.footer, { paddingBottom: (Platform.OS === 'ios' ? 30 : 14) + insets.bottom }]}>
        <TouchableOpacity style={styles.btn} onPress={handleFechar} disabled={fechando} activeOpacity={0.85}>
          {fechando
            ? <ActivityIndicator color="#fff" />
            : <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>Fechar Turno e Gerar Boletim</Text>
            </>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ResumoCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.resumoCard, { borderColor: color + '40' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.resumoValue, { color }]}>{value}</Text>
      <Text style={styles.resumoLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard:  { backgroundColor: C.navy, borderRadius: 16, padding: 20, marginBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  headerData:  { color: C.primary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  resumoCard:  { flex: 1, minWidth: '45%', backgroundColor: C.bgCard, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5 },
  resumoValue: { fontSize: 28, fontWeight: '800', marginVertical: 4 },
  resumoLabel: { fontSize: 11, color: C.textSub, fontWeight: '600' },
  prodCard:    { backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  prodTitle:   { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 },
  prodLabel:   { fontSize: 13, color: C.textSub },
  barBg:       { height: 8, backgroundColor: C.border, borderRadius: 4, marginBottom: 8 },
  barFill:     { height: 8, borderRadius: 4 },
  prodMeta:    { fontSize: 11, color: C.textMuted },
  avalCard:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.yellowBg, borderRadius: 10, padding: 12, marginBottom: 10 },
  avalText:    { fontSize: 13, color: C.yellowText },
  alertCard:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.yellowBg, borderRadius: 10, padding: 12, marginBottom: 10 },
  alertText:   { fontSize: 13, color: C.yellowText },
  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:         { backgroundColor: C.navy, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
})
