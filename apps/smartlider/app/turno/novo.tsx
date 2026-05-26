import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore, { type Turno } from '../../src/store/useLiderStore'
import { C, TURNO_LABEL, todayISO, fmtDate } from '../../src/lib/theme'

type Frente = { id: string; codigo: string; nome: string }
type Equipe  = { id: string; codigo: string; nome: string }

export default function IniciarTurnoScreen() {
  const router         = useRouter()
  const { workspaceId, setTurnoAtivo, setWorkspaceId } = useLiderStore()

  const [frentes,  setFrentes]  = useState<Frente[]>([])
  const [equipes,  setEquipes]  = useState<Equipe[]>([])
  const [frente,   setFrente]   = useState<Frente | null>(null)
  const [equipe,   setEquipe]   = useState<Equipe | null>(null)
  const [turno,    setTurno]    = useState<Turno>('manha')
  const [data,     setData]     = useState(todayISO())
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(true)

  // Carrega frentes — sempre via auth + lider_equipes (garante workspace correto)
  useEffect(() => {
    let cancelled = false
    async function carregarFrentes() {
      try {
        // 1) Obtém usuário autenticado
        const { data: authData } = await supabase.auth.getUser()
        const uid   = authData.user?.id
        const email = authData.user?.email
        if (!uid) { if (!cancelled) setFetching(false); return }

        // 2) Descobre workspace pelo lider_id ou lider_email
        let wsId = ''
        const { data: eqById } = await supabase
          .from('lider_equipes')
          .select('workspace_id')
          .eq('lider_id', uid)
          .limit(1)
          .maybeSingle()
        if (eqById?.workspace_id) {
          wsId = eqById.workspace_id
        } else if (email) {
          const { data: eqByEmail } = await supabase
            .from('lider_equipes')
            .select('workspace_id')
            .eq('lider_email', email)
            .limit(1)
            .maybeSingle()
          if (eqByEmail?.workspace_id) wsId = eqByEmail.workspace_id
        }

        if (!wsId && workspaceId) wsId = workspaceId

        if (!wsId) { if (!cancelled) setFetching(false); return }

        if (!cancelled) setWorkspaceId(wsId)

        const { data: frs, error } = await supabase
          .from('lider_frentes')
          .select('id, codigo, nome')
          .eq('workspace_id', wsId)
          .eq('ativo', true)
          .order('codigo')
        if (!cancelled) {
          if (!error && frs) setFrentes(frs)
          setFetching(false)
        }
      } catch {
        if (!cancelled) setFetching(false)
      }
    }
    carregarFrentes()
    return () => { cancelled = true }
  }, [])

  // Carrega equipes quando frente muda
  useEffect(() => {
    if (!frente) { setEquipes([]); setEquipe(null); return }
    supabase.from('lider_equipes').select('id, codigo, nome').eq('frente_id', frente.id).eq('ativo', true)
      .order('codigo').then(({ data, error }) => {
        if (!error && data) setEquipes(data)
        setEquipe(null)
      })
  }, [frente])

  async function handleIniciar() {
    if (!frente)  { Alert.alert('Atenção', 'Selecione a frente de trabalho'); return }
    if (!equipe)  { Alert.alert('Atenção', 'Selecione a equipe'); return }

    setLoading(true)
    try {
      const { data: user } = await supabase.auth.getUser()

      const { data: existing } = await supabase.from('lider_turnos')
        .select('id, status')
        .eq('equipe_id', equipe.id)
        .eq('data',      data)
        .eq('turno',     turno)
        .single()

      let turnoId: string

      if (existing) {
        turnoId = existing.id
        if (existing.status === 'fechado') {
          Alert.alert('Turno Fechado', 'Este turno já foi fechado e não pode ser reaberto.')
          setLoading(false); return
        }
      } else {
        const { data: novo, error } = await supabase.from('lider_turnos').insert({
          workspace_id: workspaceId,
          frente_id:    frente.id,
          equipe_id:    equipe.id,
          lider_id:     user.user?.id,
          data,
          turno,
          status: 'aberto',
        }).select('id').single()

        if (error) {
          Alert.alert('Erro', 'Não foi possível iniciar o turno: ' + error.message)
          setLoading(false); return
        }
        turnoId = novo.id
      }

      setTurnoAtivo({
        id:          turnoId,
        frente_id:   frente.id,
        frente_nome: `${frente.codigo} · ${frente.nome}`,
        equipe_id:   equipe.id,
        equipe_nome: equipe.codigo,
        lider_nome:  user.user?.user_metadata?.nome || user.user?.email || '',
        data,
        turno,
        status: 'aberto',
      })
      router.replace('/(tabs)')
    } catch (e: any) {
      Alert.alert('Erro', 'Falha ao iniciar turno. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  const TURNOS: { id: Turno; label: string; icon: string; color: string }[] = [
    { id: 'manha', label: 'Manhã',  icon: '🌅', color: '#F59E0B' },
    { id: 'tarde', label: 'Tarde',  icon: '☀️', color: '#F97316' },
    { id: 'noite', label: 'Noite',  icon: '🌙', color: '#6366F1' },
  ]

  if (fetching) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
            style={{ marginRight: 12 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Iniciar Turno</Text>
            <Text style={styles.headerSub}>{fmtDate(data)}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Seleção de Frente */}
        <Section label="Frente de Trabalho">
          {frentes.length === 0
            ? <Text style={styles.empty}>Nenhuma frente cadastrada</Text>
            : frentes.map(f => (
              <SelCard
                key={f.id}
                label={f.codigo}
                sub={f.nome}
                selected={frente?.id === f.id}
                onPress={() => setFrente(f)}
              />
            ))
          }
        </Section>

        {/* Seleção de Equipe */}
        {frente && (
          <Section label="Equipe">
            {equipes.length === 0
              ? <Text style={styles.empty}>Nenhuma equipe nesta frente</Text>
              : equipes.map(e => (
                <SelCard
                  key={e.id}
                  label={e.codigo}
                  sub={e.nome}
                  selected={equipe?.id === e.id}
                  onPress={() => setEquipe(e)}
                />
              ))
            }
          </Section>
        )}

        {/* Seleção de Turno */}
        <Section label="Turno">
          <View style={styles.turnoRow}>
            {TURNOS.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.turnoCard, turno === t.id && { borderColor: t.color, backgroundColor: t.color + '18' }]}
                onPress={() => setTurno(t.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.turnoIcon}>{t.icon}</Text>
                <Text style={[styles.turnoLabel, turno === t.id && { color: t.color, fontWeight: '700' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Resumo antes de confirmar */}
        {frente && equipe && (
          <View style={styles.resumoCard}>
            <Text style={styles.resumoTitle}>Confirmar Turno</Text>
            <Row label="Frente"  value={`${frente.codigo} · ${frente.nome}`} />
            <Row label="Equipe"  value={`${equipe.codigo} · ${equipe.nome}`} />
            <Row label="Turno"   value={TURNO_LABEL[turno]} />
            <Row label="Data"    value={fmtDate(data)} />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Botão fixo no rodapé */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, (!frente || !equipe) && styles.btnDisabled]}
          onPress={handleIniciar}
          disabled={!frente || !equipe || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>▶  Iniciar Turno</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

/* ── helpers ─────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  )
}

function SelCard({ label, sub, selected, onPress }: { label: string; sub: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.selCard, selected && styles.selCardActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.selLabel, selected && styles.selLabelActive]}>{label}</Text>
      <Text style={[styles.selSub,   selected && { color: C.primaryDark }]}>{sub}</Text>
      {selected && <View style={styles.check}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text></View>}
    </TouchableOpacity>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 13, color: C.textSub }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

/* ── styles ──────────────────────────────────────── */
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  header:         { backgroundColor: C.navy, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle:    { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub:      { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  scroll:         { padding: 16 },
  section:        { marginBottom: 20 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  selCard:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 8, backgroundColor: C.bgCard },
  selCardActive:  { borderColor: C.primary, backgroundColor: C.greenBg },
  selLabel:       { fontSize: 15, fontWeight: '700', color: C.text, width: 60 },
  selLabelActive: { color: C.primaryDark },
  selSub:         { flex: 1, fontSize: 13, color: C.textSub, marginLeft: 8 },
  check:          { width: 22, height: 22, borderRadius: 11, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  turnoRow:       { flexDirection: 'row', gap: 10 },
  turnoCard:      { flex: 1, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 14, backgroundColor: C.bgCard },
  turnoIcon:      { fontSize: 26 },
  turnoLabel:     { fontSize: 13, color: C.textSub, marginTop: 4, fontWeight: '600' },
  resumoCard:     { backgroundColor: C.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  resumoTitle:    { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  empty:          { fontSize: 13, color: C.textMuted, fontStyle: 'italic' },
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border },
  btn:            { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:    { backgroundColor: C.textMuted },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 16 },
})
