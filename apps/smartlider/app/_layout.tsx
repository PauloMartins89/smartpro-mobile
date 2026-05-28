import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../src/lib/supabase'
import { useRouter, useSegments } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import useLiderStore from '../src/store/useLiderStore'
import type { LiderPerfil } from '../src/store/useLiderStore'
import { initLogger } from '../src/lib/logger'

// Inicia captura de logs o mais cedo possível
initLogger()

// Error boundary global — captura crashes de render em qualquer rota
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={eb.container}>
      <Ionicons name="warning-outline" size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
      <Text style={eb.title}>Algo deu errado</Text>
      <Text style={eb.msg}>{error?.message || 'Erro desconhecido'}</Text>
      <TouchableOpacity style={eb.btn} onPress={retry}>
        <Text style={eb.btnText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  )
}
const eb = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0D1B2A', justifyContent: 'center', alignItems: 'center', padding: 32 },
  title:      { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  msg:        { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 32 },
  btn:        { backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
})

const GLOBAL_WS = '00000000-0000-0000-0000-000000000001'

async function fetchAndSetLiderPerfil(userId: string, setLiderPerfil: (p: LiderPerfil | null) => void) {
  const { data } = await supabase
    .from('lider_perfis')
    .select(`
      id, matricula, nome, workspace_id, equipe_id,
      lider_equipes (
        id, nome, codigo,
        lider_frentes ( id, nome, codigo )
      )
    `)
    .eq('user_id', userId)
    .eq('ativo', true)
    .maybeSingle()

  if (!data) return

  const eq  = (data as any).lider_equipes
  const fr  = eq?.lider_frentes

  const perfil: LiderPerfil = {
    id:            data.id,
    matricula:     data.matricula,
    nome:          data.nome || '',
    workspace_id:  data.workspace_id,
    equipe_id:     eq?.id    ?? null,
    equipe_nome:   eq?.nome  ?? null,
    equipe_codigo: eq?.codigo ?? null,
    frente_id:     fr?.id    ?? null,
    frente_nome:   fr?.nome  ?? null,
    frente_codigo: fr?.codigo ?? null,
  }
  setLiderPerfil(perfil)
}

export default function RootLayout() {
  const router          = useRouter()
  const segments        = useSegments()
  const setLiderPerfil  = useLiderStore(s => s.setLiderPerfil)
  const setWorkspaceId  = useLiderStore(s => s.setWorkspaceId)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      console.log('[Boot] init start')
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
        setReady(true)
        console.log('[Boot] ready')
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const inAuth = segments[0] === '(auth)'
      if (!session && !inAuth) router.replace('/(auth)/login')
      if (session  &&  inAuth) router.replace('/(tabs)')
      if (session) fetchAndSetLiderPerfil(session.user.id, setLiderPerfil)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D1B2A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"      options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen name="apontamento" options={{ headerShown: false }} />
        <Stack.Screen name="solicitacao" options={{ headerShown: false }} />
        <Stack.Screen name="turno/novo"  options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="fechamento"  options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
