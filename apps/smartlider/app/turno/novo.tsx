import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore, { type Turno } from '../../src/store/useLiderStore'
import { C, TURNO_LABEL, todayISO, fmtDate } from '../../src/lib/theme'

/** Sugestao de turno pelo horario atual */
function turnoByHora(): Turno {
  const h = new Date().getHours()
  if (h >= 6  && h < 14) return 'manha'
  if (h >= 14 && h < 22) return 'tarde'
  return 'noite'
}

const TURNOS: { id: Turno; label: string; icon: string; color: string }[] = [
  { id: 'manha', label: 'Manha',  icon: '🌅', color: '#F59E0B' },
  { id: 'tarde', label: 'Tarde',  icon: '☀️', color: '#F97316' },
  { id: 'noite', label: 'Noite',  icon: '🌙', color: '#6366F1' },
]

export default function IniciarTurnoScreen() {
  const router         = useRouter()
  const liderPerfil    = useLiderStore(s => s.liderPerfil)
  const setTurnoAtivo  = useLiderStore(s => s.setTurnoAtivo)

  const [turno,   setTurno]   = useState<Turno>(turnoByHora())
  const [data,    setData]    = useState(todayISO())
  const [loading, setLoading] = useState(false)

  if (!liderPerfil) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { marginLeft: 12 }]}>Iniciar Turno</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={styles.alertCard}>
            <Ionicons name="warning-outline" size={22} color="#F59E0B" />
            <Text style={styles.alertText}>
              Perfil nao encontrado.{'\n'}Contate o administrador para vincular sua matricula a uma equipe.
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (!liderPerfil.equipe_id) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Iniciar Turno</Text>
            <Text style={styles.headerSub}>Matricula {liderPerfil.matricula}</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={styles.alertCard}>
            <Ionicons name="warning-outline" size={22} color="#F59E0B" />
            <Text style={styles.alertText}>
              Nenhuma equipe vinculada.{'\n'}Contate o administrador.
            </Text>
          </View>
        </View>
      </View>
    )
  }

  async function handleIniciar() {
    setLoading(true)
    try {
      const { data: authUser } = await supabase.auth.getUser()
      const uid = authUser.user?.id

      const { data: existing } = await supabase
        .from('lider_turnos')
        .select('id, status')
        .eq('equipe_id', liderPerfil.equipe_id!)
        .eq('data',  data)
        .eq('turno', turno)
        .single()

      let turnoId: string

      if (existing) {
        if (existing.status === 'fechado') {
          Alert.alert('Turno Fechado', 'Este turno ja foi fechado e nao pode ser reaberto.')
          setLoading(false); return
        }
        turnoId = existing.id
      } else {
        const { data: novo, error } = await supabase
          .from('lider_turnos')
          .insert({
            workspace_id: liderPerfil.workspace_id,
            frente_id:    liderPerfil.frente_id,
            equipe_id:    liderPerfil.equipe_id,
            lider_id:     uid,
            lider_nome:   liderPerfil.nome,
            data,
            turno,
            status: 'aberto',
          })
          .select('id')
          .single()

        if (error) {
          Alert.alert('Erro', 'Nao foi possivel iniciar o turno: ' + error.message)
          setLoading(false); return
        }
        turnoId = novo.id
      }

      setTurnoAtivo({
        id:          turnoId,
        frente_id:   liderPerfil.frente_id   ?? '',
        frente_nome: liderPerfil.frente_codigo && liderPerfil.frente_nome
          ? `${liderPerfil.frente_codigo} · ${liderPerfil.frente_nome}`
          : (liderPerfil.frente_nome ?? ''),
        equipe_id:   liderPerfil.equipe_id!,
        equipe_nome: liderPerfil.equipe_codigo ?? liderPerfil.equipe_nome ?? '',
        lider_nome:  liderPerfil.nome,
        data,
        turno,
        status: 'aberto',
      })
      router.replace('/(tabs)')
    } catch {
      Alert.alert('Erro', 'Falha ao iniciar turno. Verifique sua conexao.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
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
            <Text style={styles.headerSub}>Matricula {liderPerfil.matricula}  ·  {fmtDate(data)}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.perfilCard}>
          <View style={styles.perfilIcon}>
            <Ionicons name="person" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.perfilNome}>{liderPerfil.nome}</Text>
            <Text style={styles.perfilSub}>Matricula {liderPerfil.matricula}</Text>
          </View>
        </View>

        <View style={styles.autoCard}>
          <View style={styles.autoCardLeft}>
            <Ionicons name="people" size={22} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoLabel}>Sua Equipe</Text>
            <Text style={styles.autoEquipe}>{liderPerfil.equipe_codigo} · {liderPerfil.equipe_nome}</Text>
            {liderPerfil.frente_nome && (
              <Text style={styles.autoFrente}>{liderPerfil.frente_codigo} · {liderPerfil.frente_nome}</Text>
            )}
          </View>
          <Ionicons name="checkmark-circle" size={22} color={C.primary} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Turno</Text>
          <View style={styles.turnoRow}>
            {TURNOS.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.turnoCard, turno === t.id && { borderColor: t.color, backgroundColor: t.color + '18' }]}
                onPress={() => setTurno(t.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.turnoIcon}>{t.icon}</Text>
                <Text style={[styles.turnoLabel, turno === t.id && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
                {turno === t.id && <Text style={{ fontSize: 9, color: t.color, fontWeight: '700', marginTop: 2 }}>selecionado</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.resumoCard}>
          <Text style={styles.resumoTitle}>Resumo do Turno</Text>
          {liderPerfil.frente_nome && <Row label="Frente" value={`${liderPerfil.frente_codigo} · ${liderPerfil.frente_nome}`} />}
          <Row label="Equipe" value={`${liderPerfil.equipe_codigo} · ${liderPerfil.equipe_nome}`} />
          <Row label="Turno"  value={TURNO_LABEL[turno]} />
          <Row label="Data"   value={fmtDate(data)} />
          <Row label="Lider"  value={liderPerfil.nome} />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleIniciar} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>▶  Iniciar Turno</Text>}
        </TouchableOpacity>
      </View>
    </View>
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

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  header:         { backgroundColor: C.navy, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle:    { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub:      { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  scroll:         { padding: 16 },
  section:        { marginBottom: 20 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  perfilCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border, gap: 12 },
  perfilIcon:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center' },
  perfilNome:     { fontSize: 15, fontWeight: '700', color: C.text },
  perfilSub:      { fontSize: 12, color: C.textSub, marginTop: 1 },
  autoCard:       { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.primary, borderRadius: 14, padding: 16, marginBottom: 20, backgroundColor: C.greenBg, gap: 12 },
  autoCardLeft:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  autoLabel:      { fontSize: 11, fontWeight: '700', color: C.primaryDark, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  autoEquipe:     { fontSize: 16, fontWeight: '700', color: C.text },
  autoFrente:     { fontSize: 12, color: C.textSub, marginTop: 2 },
  alertCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF9C3', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FDE047' },
  alertText:      { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  turnoRow:       { flexDirection: 'row', gap: 10 },
  turnoCard:      { flex: 1, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 14, backgroundColor: C.bgCard },
  turnoIcon:      { fontSize: 26 },
  turnoLabel:     { fontSize: 13, color: C.textSub, marginTop: 4, fontWeight: '600' },
  resumoCard:     { backgroundColor: C.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  resumoTitle:    { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bgCard, padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border },
  btn:            { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 16 },
})
