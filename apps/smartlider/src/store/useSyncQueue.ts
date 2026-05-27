// @ts-nocheck
/**
 * useSyncQueue — hook de sincronização automática offline→online
 *
 * Estratégia:
 * - Quando o app volta ao foreground (AppState: background → active), tenta
 *   sincronizar registros pendentes da fila (useSyncStore).
 * - Faz um ping leve na URL do Supabase antes de tentar (evita tentativas
 *   desnecessárias sem rede).
 * - Deve ser montado UMA VEZ no layout raiz das tabs.
 */
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import useSyncStore from './useSyncStore'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

/** Testa conectividade com o servidor: true = online */
async function isOnline(): Promise<boolean> {
  if (!SUPABASE_URL) return true   // fallback: tenta mesmo assim
  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 5_000)
    const res  = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: ctrl.signal,
    })
    clearTimeout(tid)
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

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

    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const wasBackground = prevStateRef.current === 'background' || prevStateRef.current === 'inactive'
      const isActive      = nextState === 'active'

      if (wasBackground && isActive) {
        // App voltou ao primeiro plano — verifica fila
        const { queue: currentQueue } = useSyncStore.getState()
        if (currentQueue.length > 0) {
          const online = await isOnline()
          if (online) {
            await sync()
          }
        }
      }

      prevStateRef.current = nextState
    })

    return () => sub.remove()
  }, [])  // sem deps: registra uma vez por ciclo de vida do layout
}
