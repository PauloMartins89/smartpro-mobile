import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../src/lib/supabase'
import { useRouter, useSegments } from 'expo-router'
import useLiderStore from '../src/store/useLiderStore'

const GLOBAL_WS = '00000000-0000-0000-0000-000000000001'

async function fetchAndSetWorkspace(userId: string, setWorkspaceId: (id: string) => void) {
  // Exclui o workspace global (seed) e pega o workspace real do usuário
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .neq('workspace_id', GLOBAL_WS)
    .limit(1)
    .maybeSingle()
  if (data?.workspace_id) setWorkspaceId(data.workspace_id)
}

export default function RootLayout() {
  const router          = useRouter()
  const segments        = useSegments()
  const setWorkspaceId  = useLiderStore(s => s.setWorkspaceId)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const inAuth = segments[0] === '(auth)'
        if (!session && !inAuth) router.replace('/(auth)/login')
        if (session  &&  inAuth) router.replace('/(tabs)')
        if (session) fetchAndSetWorkspace(session.user.id, setWorkspaceId)
      } catch {
        router.replace('/(auth)/login')
      } finally {
        setReady(true)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const inAuth = segments[0] === '(auth)'
      if (!session && !inAuth) router.replace('/(auth)/login')
      if (session  &&  inAuth) router.replace('/(tabs)')
      if (session) fetchAndSetWorkspace(session.user.id, setWorkspaceId)
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
