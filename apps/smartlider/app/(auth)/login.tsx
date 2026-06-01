import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { C } from '../../src/lib/theme'

function deriveEmail(matricula: string) {
  return `${matricula.trim()}@lider.smartpro`
}
// Senha deve ter >= 6 chars (política Supabase); padEnd garante isso
function derivePwd(matricula: string) {
  return matricula.trim().padEnd(8, matricula.trim())
}

export default function LoginScreen() {
  const [matricula, setMatricula] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [erro,      setErro]      = useState('')
  const router = useRouter()

  async function handleLogin() {
    const m = matricula.trim()
    if (!m) { setErro('Informe sua matrícula'); return }
    setLoading(true); setErro('')

    const email   = deriveEmail(m)
    const pwdNew  = derivePwd(m)   // padded >= 8 chars (novos usuários)
    const pwdLeg  = m              // senha legada (usuários criados antes)

    // 1. Tenta senha nova (padrão atual)
    let { error } = await supabase.auth.signInWithPassword({ email, password: pwdNew })
    if (!error) { router.replace('/(tabs)'); setLoading(false); return }

    // 2. Tenta senha legada (usuários mais antigos)
    ;({ error } = await supabase.auth.signInWithPassword({ email, password: pwdLeg }))
    if (!error) { router.replace('/(tabs)'); setLoading(false); return }

    // 3. Usuário não existe — cria automaticamente (primeiro acesso)
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password: pwdNew,
      options: { data: { matricula: m } },
    })
    if (signUpErr && !signUpErr.message?.toLowerCase().includes('already')) {
      setErro('Matrícula não encontrada. Fale com o administrador.')
      setLoading(false)
      return
    }

    // 4. Entra com a senha nova após criar
    ;({ error } = await supabase.auth.signInWithPassword({ email, password: pwdNew }))
    if (error) {
      setErro('Primeiro acesso registrado. Tente novamente.')
      setLoading(false)
      return
    }

    router.replace('/(tabs)')
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Dots background (decorativo) */}
        <View style={styles.dotsTopRight} />
        <View style={styles.dotsBottomLeft} />

        {/* ── HERO ──────────────────────────────────��───── */}
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <Text style={styles.brandWhite}>Smart</Text>
            <Text style={styles.brandGreen}>Pro</Text>
          </View>
          <View style={styles.taglineBar} />

          <View style={styles.titleRow}>
            <Text style={styles.titleWhite}>Smart</Text>
            <Text style={styles.titleGreen}>Líder</Text>
          </View>

          <Text style={styles.tagline}>GESTÃO OPERACIONAL INTELIGENTE</Text>
          <View style={styles.taglineBar} />
        </View>

        {/* ── CARD ──────────────────────────────────────── */}
        <View style={styles.card}>
          {/* Ícone + header */}
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-circle-outline" size={32} color={C.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.cardTitle}>Acesso do Líder</Text>
              <Text style={styles.cardSub}>
                Informe sua matrícula para acessar{'\n'}sua rotina operacional.
              </Text>
            </View>
          </View>

          {/* Campo matrícula */}
          <Text style={styles.fieldLabel}>MATRÍCULA</Text>
          <View style={[styles.inputWrap, !!erro && styles.inputWrapError]}>
            <Ionicons name="id-card-outline" size={20} color={C.textMuted} style={styles.inputIcon} />
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              value={matricula}
              onChangeText={t => { setMatricula(t); setErro('') }}
              placeholder="Digite sua matrícula"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
          </View>

          {!!erro && (
            <View style={styles.erroRow}>
              <Ionicons name="alert-circle-outline" size={14} color={C.red} />
              <Text style={styles.erroText}>{erro}</Text>
            </View>
          )}

          {/* Botão entrar */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnLoading]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={22} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.btnText}>Entrar no SmartLider</Text>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
              </>
            )}
          </TouchableOpacity>

          {/* Seguro */}
          <View style={styles.seguroRow}>
            <View style={styles.seguroLine} />
            <View style={styles.seguroInner}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primary} />
              <Text style={styles.seguroText}>Acesso seguro e protegido</Text>
            </View>
            <View style={styles.seguroLine} />
          </View>
        </View>

        {/* ── FOOTER ────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerDivider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerIcon}>
              <Ionicons name="stats-chart" size={12} color={C.primary} />
            </View>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.version}>SmartLider v1.0.1</Text>
          <View style={styles.connRow}>
            <Text style={styles.connText}>Operação conectada à </Text>
            <Text style={styles.connBrand}>SmartPro</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const DOT_COLOR = 'rgba(255,255,255,0.04)'

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0B1929' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  /* Dots decorativos */
  dotsTopRight:   { position: 'absolute', top: 0, right: 0, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(34,197,94,0.06)', transform: [{ scale: 2.5 }] },
  dotsBottomLeft: { position: 'absolute', bottom: 60, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(59,130,246,0.05)', transform: [{ scale: 2 }] },

  /* Hero */
  hero:       { alignItems: 'center', marginBottom: 28 },
  brandRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  brandWhite: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  brandGreen: { fontSize: 22, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  titleWhite: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  titleGreen: { fontSize: 52, fontWeight: '900', color: C.primary, letterSpacing: -2 },
  tagline:    { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 3, marginTop: 6, fontWeight: '600' },
  taglineBar: { width: 40, height: 2.5, backgroundColor: C.primary, borderRadius: 2, marginTop: 8 },

  /* Card */
  card: {
    backgroundColor: '#fff',
    borderRadius:    22,
    padding:         24,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 12 },
    shadowOpacity:   0.3,
    shadowRadius:    24,
    elevation:       12,
    marginBottom:    24,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  iconCircle: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: '#E8FBF0',
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: C.textSub, lineHeight: 19 },

  /* Campo */
  fieldLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         C.textSub,
    letterSpacing: 1.5,
    marginBottom:  8,
  },
  inputWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     C.border,
    borderRadius:    12,
    backgroundColor: C.bgMuted,
    marginBottom:    16,
    overflow:        'hidden',
  },
  inputWrapError: { borderColor: C.red },
  inputIcon:      { paddingHorizontal: 14 },
  inputDivider:   { width: 1, height: 24, backgroundColor: C.border },
  input: {
    flex:          1,
    paddingHorizontal: 14,
    paddingVertical:   14,
    fontSize:      16,
    color:         C.text,
    letterSpacing: 2,
  },
  erroRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: -8 },
  erroText: { color: C.red, fontSize: 12, fontWeight: '600' },

  /* Botão */
  btn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.primary,
    borderRadius:    14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor:     C.primary,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.4,
    shadowRadius:    10,
    elevation:       6,
  },
  btnLoading: { opacity: 0.75, justifyContent: 'center' },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },

  /* Footer */
  footer:        { alignItems: 'center' },
  seguroRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  seguroLine:    { flex: 1, height: 1, backgroundColor: C.border },
  seguroInner:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  seguroText:    { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  footerDivider: { flexDirection: 'row', alignItems: 'center', width: '70%', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerIcon: { marginHorizontal: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  version:     { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  connRow:     { flexDirection: 'row' },
  connText:    { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  connBrand:   { color: C.primary, fontSize: 12, fontWeight: '700' },
})
