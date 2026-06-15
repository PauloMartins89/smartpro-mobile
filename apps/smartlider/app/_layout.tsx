import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Clipboard, Animated, AppState } from 'react-native'
import * as Updates from 'expo-updates'
import * as SplashScreen from 'expo-splash-screen'
import { Stack } from 'expo-router'

// Mantém o splash nativo visível — só oculta quando nossa tela estiver pintada
SplashScreen.preventAutoHideAsync().catch(() => {})

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useRouter, useSegments } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import useLiderStore from '../src/store/useLiderStore'
import type { LiderPerfil } from '../src/store/useLiderStore'
import { initLogger, getLogs } from '../src/lib/logger'
import { iniciarTelemetria, finalizarTelemetria, flushTelemetria } from '../src/lib/telemetria'
import SplashAnimated from '../src/components/splash/SplashAnimated'
import * as Location from 'expo-location'

initLogger()

// ─────────────────────────────────────────────────────────────────────────────
// Fases controladas do boot:
//   'boot'      → tela de branding (carregando / verificando OTA / autenticando)
//   'updating'  → OTA disponível — mostra tela de atualização explícita
//   'ready'     → app carregado, renderiza Stack normalmente
// ─────────────────────────────────────────────────────────────────────────────
type Phase = 'boot' | 'updating' | 'ready'

// ── Tela de Boot (branding + status) ─────────────────────────────────────────
function BootScreen({ status, onLayout }: { status: string; onLayout?: () => void }) {
  const bar = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 1400, useNativeDriver: false }),
        Animated.timing(bar, { toValue: 0, duration: 0,    useNativeDriver: false }),
      ])
    ).start()
  }, [])
  const barLeft = bar.interpolate({ inputRange: [0, 1], outputRange: ['-40%', '110%'] })

  return (
    <View style={boot.root} onLayout={onLayout}>
      <View style={boot.logoRow}>
        <View style={boot.logoCircle}>
          <Ionicons name="stats-chart" size={16} color="#22C55E" />
        </View>
        <Text style={boot.logoText}>
          <Text style={boot.logoWhite}>Smart</Text>
          <Text style={boot.logoGreen}>Pro</Text>
        </Text>
      </View>

      <View style={boot.titleRow}>
        <Text style={boot.titleWhite}>Smart</Text>
        <Text style={boot.titleGreen}>Lider</Text>
      </View>

      <View style={boot.tagBar} />
      <Text style={boot.tagline}>GESTÃO OPERACIONAL INTELIGENTE</Text>
      <View style={boot.tagBar} />

      <View style={boot.loadingArea}>
        <Text style={boot.statusText}>{status}</Text>
        <View style={boot.barBg}>
          <Animated.View style={[boot.shimmer, { left: barLeft }]} />
        </View>
      </View>

      <View style={boot.footer}>
        <Ionicons name="globe-outline" size={13} color="#22C55E" />
        <Text style={boot.footerText}>
          Operação conectada à <Text style={boot.footerBrand}>SmartPro</Text>
        </Text>
      </View>
    </View>
  )
}

// ── Tela de Atualização (OTA explícita) ───────────────────────────────────────
function UpdateScreen({ onLayout }: { onLayout?: () => void }) {
  const prog = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(prog, { toValue: 0.9, duration: 8000, useNativeDriver: false }).start()
  }, [])
  const barW = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <View style={boot.root} onLayout={onLayout}>
      <View style={boot.logoRow}>
        <View style={boot.logoCircle}>
          <Ionicons name="stats-chart" size={16} color="#22C55E" />
        </View>
        <Text style={boot.logoText}>
          <Text style={boot.logoWhite}>Smart</Text>
          <Text style={boot.logoGreen}>Pro</Text>
        </Text>
      </View>

      <View style={upd.iconBox}>
        <Ionicons name="cloud-download-outline" size={48} color="#22C55E" />
      </View>
      <Text style={upd.title}>Atualizando SmartLíder</Text>
      <Text style={upd.sub}>Baixando nova versão...</Text>

      <View style={boot.barBg}>
        <Animated.View style={[boot.barFill, { width: barW }]} />
      </View>
      <Text style={upd.hint}>O app será reiniciado automaticamente</Text>
    </View>
  )
}

const upd = StyleSheet.create({
  iconBox: { marginBottom: 20 },
  title:   { color: '#fff',    fontSize: 20, fontWeight: '700', marginBottom: 6 },
  sub:     { color: '#8a9ab0', fontSize: 14, marginBottom: 24 },
  hint:    { color: '#5a6a7a', fontSize: 12, marginTop: 16 },
})

const boot = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0B1A3B', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 44 },
  logoCircle:  { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  logoText:    { fontSize: 17, fontWeight: '700' },
  logoWhite:   { color: '#fff' },
  logoGreen:   { color: '#22C55E' },
  titleRow:    { flexDirection: 'row', alignItems: 'baseline' },
  titleWhite:  { fontSize: 58, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  titleGreen:  { fontSize: 58, fontWeight: '900', color: '#22C55E', letterSpacing: -1 },
  tagBar:      { width: 44, height: 3, backgroundColor: '#22C55E', borderRadius: 2, marginVertical: 14 },
  tagline:     { color: '#8a9ab0', fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  loadingArea: { marginTop: 52, width: '100%', alignItems: 'center' },
  statusText:  { color: '#8a9ab0', fontSize: 13, marginBottom: 14 },
  barBg:       { width: '78%', height: 4, backgroundColor: '#1a2636', borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: '100%', backgroundColor: '#22C55E', borderRadius: 2 },
  shimmer:     { position: 'absolute', top: 0, bottom: 0, width: '40%', backgroundColor: 'rgba(34,197,94,0.5)', borderRadius: 2 },
  footer:      { position: 'absolute', bottom: 40, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText:  { color: '#5a6a7a', fontSize: 13 },
  footerBrand: { color: '#22C55E', fontWeight: '700' },
})

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const logs = getLogs().slice(0, 30)
  const logText = logs.map(l => `[${l.time}][${l.level.toUpperCase()}] ${l.msg}`).join('\n')
  const fullReport = `ERRO: ${error?.message || 'Erro desconhecido'}\n\nSTACK:\n${error?.stack || ''}\n\nLOGS:\n${logText}`

  return (
    <View style={eb.container}>
      <Ionicons name="warning-outline" size={48} color="#F59E0B" style={{ marginBottom: 12 }} />
      <Text style={eb.title}>Algo deu errado</Text>
      <Text style={eb.msg}>{error?.message || 'Erro desconhecido'}</Text>

      {/* Logs compactos para diagnóstico */}
      <ScrollView style={eb.logBox} contentContainerStyle={{ paddingBottom: 8 }}>
        {logs.map((l, i) => (
          <Text key={i} style={[eb.logLine, l.level === 'error' ? eb.logError : l.level === 'warn' ? eb.logWarn : eb.logInfo]}>
            [{l.time}] {l.msg}
          </Text>
        ))}
      </ScrollView>

      <TouchableOpacity style={eb.btnSecondary} onPress={() => Clipboard.setString(fullReport)}>
        <Text style={eb.btnSecondaryText}>Copiar logs</Text>
      </TouchableOpacity>
      <TouchableOpacity style={eb.btn} onPress={retry}>
        <Text style={eb.btnText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  )
}
const eb = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0D1B2A', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title:          { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  msg:            { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  logBox:         { width: '100%', maxHeight: 200, backgroundColor: '#0A1220', borderRadius: 8, padding: 8, marginBottom: 12 },
  logLine:        { fontFamily: 'monospace', fontSize: 10, marginBottom: 2 },
  logInfo:        { color: '#64748B' },
  logWarn:        { color: '#F59E0B' },
  logError:       { color: '#EF4444' },
  btn:            { backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginTop: 4 },
  btnText:        { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondary:   { backgroundColor: '#1E293B', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnSecondaryText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
})

const GLOBAL_WS = '00000000-0000-0000-0000-000000000001'

async function fetchAndSetLiderPerfil(userId: string, setLiderPerfil: (p: LiderPerfil | null) => void) {
  // 1. Busca perfil do líder pelo user_id
  let { data: p } = await supabase
    .from('lider_perfis')
    .select('id, matricula, nome, workspace_id, equipe_id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .maybeSingle()

  // 2. Se não encontrou pelo user_id, tenta pela matrícula (email-derivada)
  //    Isso acontece quando signUp() criou um usuário duplicado com UUID diferente
  if (!p) {
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? ''
    if (email.endsWith('@lider.smartpro')) {
      const matricula = email.replace('@lider.smartpro', '')
      const { data: pByMatricula } = await supabase
        .from('lider_perfis')
        .select('id, matricula, nome, workspace_id, equipe_id')
        .eq('matricula', matricula)
        .eq('ativo', true)
        .maybeSingle()
      if (pByMatricula) {
        // Re-vincula o perfil ao user_id atual (corrige UUID duplicado)
        await supabase
          .from('lider_perfis')
          .update({ user_id: userId })
          .eq('id', pByMatricula.id)
        p = pByMatricula
      }
    }
  }

  if (!p) return

  // 2. Busca equipe separadamente (se vinculada)
  let eq: any = null
  if (p.equipe_id) {
    const { data, error } = await supabase
      .from('lider_equipes')
      .select('id, nome, codigo, frente_id')
      .eq('id', p.equipe_id)
      .maybeSingle()
    console.log('[Perfil] equipe query:', JSON.stringify({ data, error }))
    eq = data
  }

  // 3. Busca frente separadamente (se a equipe tiver frente_id)
  let fr: any = null
  if (eq?.frente_id) {
    const { data } = await supabase
      .from('lider_frentes')
      .select('id, nome, codigo')
      .eq('id', eq.frente_id)
      .maybeSingle()
    fr = data
  }

  const perfil: LiderPerfil = {
    id:            p.id,
    matricula:     p.matricula,
    nome:          p.nome || '',
    workspace_id:  p.workspace_id,
    equipe_id:     p.equipe_id     ?? null,
    equipe_nome:   eq?.nome        ?? null,
    equipe_codigo: eq?.codigo      ?? null,
    frente_id:     fr?.id          ?? null,
    frente_nome:   fr?.nome        ?? null,
    frente_codigo: fr?.codigo      ?? null,
  }
  setLiderPerfil(perfil)
}

export default function RootLayout() {
  const router         = useRouter()
  const segments       = useSegments()
  const setLiderPerfil = useLiderStore(s => s.setLiderPerfil)
  const setWorkspaceId = useLiderStore(s => s.setWorkspaceId)

  const [phase,  setPhase]  = useState<Phase>('boot')
  const [status, setStatus] = useState('Iniciando...')
  const splashHidden = useRef(false)

  // Refs de coordenação entre boot() assíncrono e SplashAnimated (2.5s)
  const splashDoneRef   = useRef(false)
  const pendingReadyRef = useRef(false)
  const pendingNavRef   = useRef<(() => void) | null>(null)

  // ── Telemetria: controle de background ──────────────────────────────────
  const bgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // App voltou ao foreground → cancela timer de finalização
        if (bgTimer.current) { clearTimeout(bgTimer.current); bgTimer.current = null }
        // Flush pendentes
        flushTelemetria().catch(() => {})
      } else if (state === 'background') {
        // Finaliza sessão após 5 min em background (usuário saiu do campo)
        bgTimer.current = setTimeout(() => { finalizarTelemetria().catch(() => {}) }, 5 * 60_000)
      }
    })
    return () => sub.remove()
  }, [])
  // Solicita permissoes de localizacao apos o app estar pronto (fase ready = UI estavel)
  // Foreground primeiro; background somente se concedido (Android 11+: abre Settings)
  useEffect(() => {
    if (phase !== 'ready') return
    const pedir = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        // 800ms para o app estar completamente estavel antes de abrir Settings
        await new Promise(r => setTimeout(r, 800))
        await Location.requestBackgroundPermissionsAsync()
      } catch {
        // silencioso
      }
    }
    pedir()
  }, [phase])


  // Oculta splash nativo tão logo nossa tela custom está montada (mesmo BG → sem flash)
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  // Chamado pelo SplashAnimated quando a animação de 2.5s termina
  const onSplashFinish = useCallback(() => {
    splashDoneRef.current = true
    if (pendingReadyRef.current) {
      setPhase('ready')
      pendingNavRef.current?.()
      pendingNavRef.current = null
    }
  }, [])

  // onBootLayout mantido só para UpdateScreen
  const onBootLayout = useCallback(() => {
    if (splashHidden.current) return
    splashHidden.current = true
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  useEffect(() => {
    const boot = async () => {
      console.log('[Boot] start')

      // ── FASE 1: Verificar OTA ───────────────────────────────────────────────
      if (!__DEV__) {
        try {
          setStatus('Verificando atualizações...')
          console.log('[OTA] checkForUpdateAsync...')
          const check = await Updates.checkForUpdateAsync()
          console.log('[OTA] isAvailable:', check.isAvailable)

          if (check.isAvailable) {
            // Mostra tela de atualização explícita — não parece crash
            setPhase('updating')
            console.log('[OTA] baixando bundle...')
            await Updates.fetchUpdateAsync()
            console.log('[OTA] aplicando...')
            await Updates.reloadAsync()
            return // reloadAsync reinicia — não continua aqui
          }
        } catch (e: any) {
          console.warn('[OTA] erro (ignorado):', e?.message)
        }
      }

      // ── FASE 2: Autenticar ─────────────────────────────────────────────────
      try {
        setStatus('Autenticando...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[Boot] session:', !!session)

        if (session) {
          await fetchAndSetLiderPerfil(session.user.id, setLiderPerfil)
          setStatus('Carregando perfil...')
          // Inicia telemetria de campo em background (silencioso)
          const perfil = useLiderStore.getState().liderPerfil
          if (perfil?.workspace_id) {
            iniciarTelemetria({ userId: session.user.id, workspaceId: perfil.workspace_id }).catch(() => {})
          }
        }

        // ── FASE 3: Navegar (aguarda splash se ainda em andamento) ───────────
        pendingReadyRef.current = true
        pendingNavRef.current = () => {
          const inAuth = segments[0] === '(auth)'
          if (!session && !inAuth) router.replace('/(auth)/login')
          if (session  &&  inAuth) router.replace('/(tabs)')
          // Registra listener de auth SOMENTE após boot completo (sem race condition)
          supabase.auth.onAuthStateChange((_e, sess) => {
            const isAuth = segments[0] === '(auth)'
            if (!sess && !isAuth) router.replace('/(auth)/login')
            if (sess  &&  isAuth) router.replace('/(tabs)')
            if (sess) {
              fetchAndSetLiderPerfil(sess.user.id, setLiderPerfil).then(() => {
                // Inicia telemetria se ainda não estiver rodando (ex: login pelo app)
                const perfil = useLiderStore.getState().liderPerfil
                if (perfil?.workspace_id) {
                  iniciarTelemetria({ userId: sess.user.id, workspaceId: perfil.workspace_id }).catch(() => {})
                }
              })
            }
          })
        }
        if (splashDoneRef.current) {
          setPhase('ready')
          pendingNavRef.current()
          pendingNavRef.current = null
        }
      } catch (e: any) {
        console.error('[Boot] erro auth:', e?.message)
        pendingReadyRef.current = true
        pendingNavRef.current = () => router.replace('/(auth)/login')
        if (splashDoneRef.current) {
          setPhase('ready')
          pendingNavRef.current()
          pendingNavRef.current = null
        }
      }
    }

    boot()
  }, [])

  // ── FASE boot: splash animado premium (2.5s) ────────────────────────────
  if (phase === 'boot') {
    return <SplashAnimated onFinish={onSplashFinish} />
  }

  // ── FASE updating: tela de atualização explícita ─────────────────────────
  if (phase === 'updating') {
    return <UpdateScreen onLayout={onBootLayout} />
  }

  // ── FASE ready: app normal ────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B1A3B' }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1A3B' } }}>
          <Stack.Screen name="(auth)"      options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
          <Stack.Screen name="apontamento" options={{ headerShown: false }} />
          <Stack.Screen name="solicitacao" options={{ headerShown: false }} />
          <Stack.Screen name="turno/novo"  options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="fechamento"  options={{ headerShown: false }} />
          <Stack.Screen name="diagnostico" options={{ headerShown: false }} />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
