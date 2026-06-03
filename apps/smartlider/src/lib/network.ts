// @ts-nocheck
import * as Network from 'expo-network'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

/**
 * Verificação local instantânea: retorna true se o dispositivo
 * claramente não tem conexão (sem precisar de ping HTTP).
 * Use antes de tentar qualquer operação Supabase para evitar
 * que o save trave por 30s esperando timeout de rede.
 */
export async function isClearlyOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync()
    return state.isConnected === false
  } catch {
    return false // assuma online se a checagem falhar
  }
}

/**
 * Ping real no servidor Supabase (5s timeout).
 * Use para verificar antes de sincronizar a fila offline.
 */
export async function isOnline(): Promise<boolean> {
  if (!SUPABASE_URL) return true
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
