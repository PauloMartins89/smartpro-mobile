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

type EquipeComFrente = {
  id:          string
  codigo:      string
  nome:        string
  workspace_id: string
  frente:      { id: string; codigo: string; nome: string } | null
}

export default function IniciarTurnoScreen() {
  const router = useRouter()
  const { workspaceId, setTurnoAtivo, setWorkspaceId } = useLiderStore()

  // Equipes vinculadas a este líder
  const [liderEquipes, setLiderEquipes] = useState<EquipeComFrente[]>([])
  const [equipe,       setEquipe]       = useState<EquipeComFrente | null>(null)
  const [turno,        setTurno]        = useState<Turno>('manha')
  const [data,         setData]         = useState(todayISO())
  const [loading,      setLoading]      = useState(false)
  const [fetching,     setFetching]     = useState(true)
  const [liderEmail,   setLiderEmail]   = useState('')

  // Carrega equipes do líder automaticamente pelo auth
  useEffect(() => {
    let cancelled = false
    async function carregar() {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const uid   = authData.user?.id
        const email = authData.user?.email ?? ''
        if (!uid) { if (!cancelled) setFetching(false); return }
        if (!cancelled) setLiderEmail(email)

        // Busca equipes vinculadas por lider_id ou lider_email, com frente via join
        const { data: rows } = await supabase
          .from('lider_equipes')
          .select('id, codigo, nome, workspace_id, lider_frentes(id, codigo, nome)')
          .or(`lider_id.eq.${uid},lider_email.eq.${email}`)
          .eq('ativo', true)
          .order('codigo')

        if (cancelled) return

        const equipes: EquipeComFrente[] = (rows ?? []).map((r: any) => ({
          id:           r.id,
          codigo:       r.codigo,
          nome:         r.nome,
          workspace_id: r.workspace_id,
          frente:       r.lider_frentes ?? null,
        }))

        setLiderEquipes(equipes)

        // Salva workspace no store
        const wsId = equipes[0]?.workspace_id ?? workspaceId
        if (wsId) setWorkspaceId(wsId)

        // Auto-seleciona se só tem uma equipe
        if (equipes.length === 1) setEquipe(equipes[0])

        setFetching(false)
      } catch {
        if (!cancelled) setFetching(false)
      }
    }
    carregar()
    return () => { cancelled = true }
  }, [])

  async function handleIniciar() {
    if (!equipe) { Alert.alert('Atenção', 'Selecione a equipe'); return }

    const frente = equipe.frente
    if (!frente) { Alert.alert('Atenção', 'Esta equipe não possui frente vinculada.'); return }

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
          workspace_id: equipe.workspace_id,
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
    } catch {
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

  // Matrícula exibida = prefixo do email (ex: "10021002@lider.smartpro" → "10021002")
  const matricula = liderEmail.split('@')[0] ?? liderEmail

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
            <Text style={styles.headerSub}>
              {matricula ? `Matrícula ${matricula}  ·  ` : ''}{fmtDate(data)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Equipe — auto ou picker */}
        {liderEquipes.length === 0 ? (
          <View style={styles.alertCard}>
            <Ionicons name="warning-outline" size={22} color="#F59E0B" />
            <Text style={styles.alertText}>
              Nenhuma equipe vinculada a esta matrícula.{'\n'}
              Contate o administrador.
            </Text>
          </View>
        ) : liderEquipes.length === 1 ? (
          /* Equipe única: card fixo — sem seleção manual */
          <View style={styles.autoCard}>
            <View style={styles.autoCardLeft}>
              <Ionicons name="people" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.autoLabel}>Sua Equipe</Text>
              <Text style={styles.autoEquipe}>
                {liderEquipes[0].codigo} · {liderEquipes[0].nome}
              </Text>
              {liderEquipes[0].frente && (
                <Text style={styles.autoFrente}>
                  {liderEquipes[0].frente.codigo} · {liderEquipes[0].frente.nome}
                </Text>
              )}
            </View>
            <Ionicons name="checkmark-circle" size={22} color={C.primary} />
          </View>
        ) : (
          /* Múltiplas equipes: picker */
          <Section label="Selecione sua Equipe">
            {liderEquipes.map(e => (
              <SelCard
                key={e.id}
                label={e.codigo}
                sub={e.frente ? `${e.frente.codigo} · ${e.nome}` : e.nome}
                selected={equipe?.id === e.id}
                onPress={() => setEquipe(e)}
              />
            ))}
          </Section>
        )}

        {/* Turno */}
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

        {/* Resumo de confirmação */}
        {equipe && (
          <View style={styles.resumoCard}>
            <Text style={styles.resumoTitle}>Confirmar</Text>
            {equipe.frente && (
              <Row label="Frente" value={`${equipe.frente.codigo} · ${equipe.frente.nome}`} />
            )}
            <Row label="Equipe" value={`${equipe.codigo} · ${equipe.nome}`} />
            <Row label="Turno"  value={TURNO_LABEL[turno]} />
            <Row label="Data"   value={fmtDate(data)} />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Botão fixo no rodapé */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !equipe && styles.btnDisabled]}
          onPress={handleIniciar}
          disabled={!equipe || loading}
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
  autoCard:       { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.primary, borderRadius: 14, padding: 16, marginBottom: 20, backgroundColor: C.greenBg, gap: 12 },
  autoCardLeft:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  autoLabel:      { fontSize: 11, fontWeight: '700', color: C.primaryDark, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  autoEquipe:     { fontSize: 16, fontWeight: '700', color: C.text },
  autoFrente:     { fontSize: 12, color: C.textSub, marginTop: 2 },
  alertCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF9C3', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FDE047' },
  alertText:      { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
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
