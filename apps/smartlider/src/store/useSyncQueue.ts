// @ts-nocheck
/**
 * useSyncQueue — hook de sincronização automática offline→online
 *
 * Estratégia:
 * - Quando o app volta ao foreground (AppState: background → active), tenta
 *   sincronizar registros pendentes da fila (useSyncStore).
 * - Quando a rede é restabelecida enquanto o app está em foreground
 *   (Network.addNetworkStateListener), também dispara a fila.
 * - Faz um ping leve na URL do Supabase antes de tentar (evita tentativas
 *   desnecessárias sem rede).
 * - Deve ser montado UMA VEZ no layout raiz das tabs.
 */
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import * as Network from 'expo-network'
import useSyncStore from './useSyncStore'
import { isOnline } from '../lib/network'

export default function useSyncQueue() {
  const sync  = useSyncStore(s => s.sync)
  const queue = useSyncStore(s => s.queue)

  // Ref para saber o estado anterior (evita re-trigger na primeira montagem)
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    // Se já há pendências ao montar, tenta imediatamente (volta de background ou
    // reabertura do app)
    console.log(`[sync-queue] montou | queue=${queue.length}`)
    if (queue.length > 0) {
      isOnline().then(online => {
        console.log(`[sync-queue] isOnline=${online} | queue=${queue.length}`)
        if (online) sync()
      })
    }

    // Listener de AppState: sincroniza quando app volta ao foreground
    const appSub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const wasBackground = prevStateRef.current === 'background' || prevStateRef.current === 'inactive'
      const isActive      = nextState === 'active'

      if (wasBackground && isActive) {
        const { queue: currentQueue } = useSyncStore.getState()
        if (currentQueue.length > 0) {
          const online = await isOnline()
          if (online) await sync()
        }
      }

      prevStateRef.current = nextState
    })

    // Listener de rede: sincroniza quando conexão é restabelecida em foreground
    const netSub = Network.addNetworkStateListener(async ({ isConnected, isInternetReachable }) => {
      if (isConnected && isInternetReachable !== false) {
        const { queue: currentQueue } = useSyncStore.getState()
        if (currentQueue.length > 0) {
          console.log(`[sync-queue] rede voltou | queue=${currentQueue.length}`)
          const online = await isOnline()
          if (online) sync()
        }
      }
    })

    return () => {
      appSub.remove()
      netSub.remove()
    }
  }, [])  // sem deps: registra uma vez por ciclo de vida do layout
}
