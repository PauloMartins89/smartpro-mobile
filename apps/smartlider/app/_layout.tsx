import { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Clipboard, Animated } from 'react-native'
import * as Updates from 'expo-updates'
import * as SplashScreen from 'expo-splash-screen'
import { Stack } from 'expo-router'

// Mantém o splash nativo visível até o React renderizar
SplashScreen.preventAutoHideAsync().catch(() => {})
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../src/lib/supabase'
import { useRouter, useSegments } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import useLiderStore from '../src/store/useLiderStore'
import type { LiderPerfil } from '../src/store/useLiderStore'
import { initLogger, getLogs } from '../src/lib/logger'

// Inicia captura de logs o mais cedo possível
initLogger()

// ── Tela de boot com branding ─────────────────────────────────────────────────
function BootScreen() {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.72,
      duration: 2200,
      useNativeDriver: false,
    }).start()
  }, [])
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
  return (
    <View style={boot.root}>
      {/* Logo SmartPro */}
      <View style={boot.logoRow}>
        <View style={boot.logoCircle}>
          <Ionicons name="stats-chart" size={16} color="#22C55E" />
        </View>
        <Text style={boot.logoText}>
          <Text style={boot.logoWhite}>Smart</Text>
          <Text style={boot.logoGreen}>Pro</Text>
        </Text>
      </View>

      {/* Título principal */}
      <View style={boot.titleRow}>
        <Text style={boot.titleWhite}>Smart</Text>
        <Text style={boot.titleGreen}>Lider</Text>
      </View>

      {/* Tagline */}
      <View style={boot.tagBar} />
      <Text style={boot.tagline}>GESTÃO OPERACIONAL INTELIGENTE</Text>
      <View style={boot.tagBar} />

      {/* Barra de progresso */}
      <View style={boot.loadingArea}>
        <Text style={boot.loadingText}>Carregando rotina operacional...</Text>
        <View style={boot.barBg}>
          <Animated.View style={[boot.barFill, { width: barWidth }]} />
        </View>
      </View>

      {/* Footer */}
      <View style={boot.footer}>
        <Ionicons name="globe-outline" size={13} color="#22C55E" />
        <Text style={boot.footerText}>
          Operação conectada à{' '}
          <Text style={boot.footerBrand}>SmartPro</Text>
        </Text>
      </View>
    </View>
  )
}

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
  loadingText: { color: '#8a9ab0', fontSize: 13, marginBottom: 14 },
  barBg:       { width: '78%', height: 4, backgroundColor: '#1a2636', borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: '100%', backgroundColor: '#22C55E', borderRadius: 2 },
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
  // 1. Busca perfil do líder (sem join — evita 406 por schema cache desatualizado)
  const { data: p } = await supabase
    .from('lider_perfis')
    .select('id, matricula, nome, workspace_id, equipe_id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .maybeSingle()

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
  const router          = useRouter()
  const segments        = useSegments()
  const setLiderPerfil  = useLiderStore(s => s.setLiderPerfil)
  const setWorkspaceId  = useLiderStore(s => s.setWorkspaceId)
  const [ready, setReady] = useState(false)
  const initDone = useRef(false)

  // Oculta o splash nativo assim que o React renderiza (BootScreen assume)
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  useEffect(() => {
    const init = async () => {
      console.log('[Boot] init start')
      // ── OTA: verifica em background — NÃO bloqueia o boot ──────────────────
      // Baixa silenciosamente e aplica na PRÓXIMA abertura do app,
      // evitando restarts abruptos que aparecem como falha para o usuário.
      if (!__DEV__) {
        ;(async () => {
          try {
            console.log('[OTA] check em background...')
            const check = await Updates.checkForUpdateAsync()
            if (check.isAvailable) {
              console.log('[OTA] update disponivel, baixando silenciosamente...')
              await Updates.fetchUpdateAsync()
              console.log('[OTA] bundle baixado — sera aplicado na proxima abertura')
              // NÃO chama reloadAsync() aqui — aplica na próxima abertura
            } else {
              console.log('[OTA] app ja esta atualizado')
            }
          } catch (e: any) {
            console.warn('[OTA] ERRO:', e?.message)
          }
        })()
      } else {
        console.log('[OTA] pulado (DEV mode)')
      }

      // ── Auth: inicializa sessão ────────────────────────────────────────────
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) console.warn('[Boot] getSession error:', error.message)
        const inAuth = segments[0] === '(auth)'
        console.log('[Boot] session:', !!session, '| inAuth:', inAuth)
        if (!session && !inAuth) { console.log('[Boot] -> login'); router.replace('/(auth)/login') }
        if (session  &&  inAuth) { console.log('[Boot] -> tabs');  router.replace('/(tabs)') }
        if (session) fetchAndSetLiderPerfil(session.user.id, setLiderPerfil)
      } catch (e: any) {
        console.error('[Boot] CRASH:', e?.message)
        router.replace('/(auth)/login')
      } finally {
        initDone.current = true
        setReady(true)
        console.log('[Boot] ready')
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      // Ignora disparo imediato enquanto init() ainda está rodando
      if (!initDone.current) return
      const inAuth = segments[0] === '(auth)'
      if (!session && !inAuth) router.replace('/(auth)/login')
      if (session  &&  inAuth) router.replace('/(tabs)')
      if (session) fetchAndSetLiderPerfil(session.user.id, setLiderPerfil)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!ready) {
    return <BootScreen />
  }

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
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
