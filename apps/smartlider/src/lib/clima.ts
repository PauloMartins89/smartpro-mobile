/**
 * @version 1.0.7-ota
 * clima.ts — Captura automática de condições climáticas via GPS + Open-Meteo.
 * Chamado ao criar um turno. Nunca bloqueia o fluxo principal (falha silenciosa).
 */
import * as Location from 'expo-location'
import { supabase } from './supabase'

/** Mapeia o código WMO do Open-Meteo para o enum da tabela */
function weatherCodeToCondicao(code: number, windKmh: number): string {
  if (code >= 95) return 'tempestade'
  if (code >= 80) return 'chuva'
  if (code >= 61) return 'chuva'
  if (code >= 51) return 'chuva'
  if (code >= 45) return 'nublado'
  if (code === 3)  return 'nublado'
  if (code === 2)  return 'parcial'
  if (code === 1)  return 'parcial'
  if (code === 0)  return windKmh >= 30 ? 'vento_forte' : 'sol'
  return 'parcial'
}

export async function captureClima(params: {
  turnoId:     string
  workspaceId: string
  equipId?:    string
  userId?:     string
}): Promise<void> {
  try {
    // 1. Verifica permissao (NAO solicita — diálogo deve ser pedido no boot, nao durante navegacao)
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') return

    // 2. Obtém coordenadas (timeout real de 8s)
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('location timeout')), 8_000)
      ),
    ])
    const { latitude, longitude } = pos.coords

    // 3. Chama Open-Meteo (gratuito, sem chave)
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation` +
      `&timezone=auto&forecast_days=1`

    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(abortTimer)
    }
    if (!res.ok) return

    const json = await res.json()
    const cur  = json.current ?? {}

    const temperatura_c   = cur.temperature_2m       ?? null
    const umidade_pct     = cur.relative_humidity_2m  ?? null
    const vento_kmh       = cur.wind_speed_10m        ?? 0
    const precipitacao_mm = cur.precipitation         ?? null
    const weatherCode     = cur.weather_code          ?? 0
    const condicao        = weatherCodeToCondicao(weatherCode, vento_kmh)

    // 4. Salva na tabela (sem bloquear caso falhe)
    await supabase.from('lider_condicoes_climaticas').insert({
      turno_id:       params.turnoId,
      workspace_id:   params.workspaceId,
      equipe_id:      params.equipId   ?? null,
      registrado_por: params.userId    ?? null,
      condicao,
      temperatura_c,
      umidade_pct,
      vento_kmh:      vento_kmh || null,
      precipitacao_mm,
    })
  } catch {
    // Falha silenciosa — clima nunca deve travar o fluxo do turno
  }
}
