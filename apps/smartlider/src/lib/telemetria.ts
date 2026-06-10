/**
 * Serviço de Telemetria de Campo — SmartLíder
 *
 * Responsabilidades:
 *  - Inicia/finaliza sessão ao abrir/fechar o app
 *  - Captura GPS com adaptive sampling
 *  - Captura acelerômetro eixo Z (RMS janela 1s)
 *  - Buffer offline em MMKV
 *  - Flush para Supabase quando há rede
 *
 * Visibilidade: apenas gestores lêem os dados (RLS no banco).
 * O líder não vê suas próprias coordenadas no app.
 */

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { Accelerometer } from 'expo-sensors'
import NetInfo from '@react-native-community/netinfo'
import { MMKV } from 'react-native-mmkv'
import { supabase } from './supabase'

// ─── Constantes ──────────────────────────────────────────────────────────────

const TASK_NAME    = 'TELEMETRIA_GPS'
const MMKV_STORAGE = new MMKV({ id: 'telemetria' })

// Thresholds de adaptive sampling
const INTERVALO_PARADO_MS  = 60_000   // < 2 km/h  → 1 ponto/min
const INTERVALO_DEVAGAR_MS = 10_000   // 2–15 km/h → 1 ponto/10s
const INTERVALO_RAPIDO_MS  =  5_000   // > 15 km/h → 1 ponto/5s
const FLUSH_A_CADA_PONTOS  = 50       // flushes quando buffer atingir N pontos

// ─── Estado em memória ───────────────────────────────────────────────────────

let sessaoId:      string | null = null
let workspaceId:   string | null = null
let userId:        string | null = null
let ultimoHeading: number        = 0
let ultimoTs:      number        = 0
let accelZ:        number[]      = []   // janela de 1s para RMS
let accelSub:      ReturnType<typeof Accelerometer.addListener> | null = null

// ─── MMKV helpers ────────────────────────────────────────────────────────────

type PontoBuffer = {
  sessao_id:   string
  workspace_id: string
  user_id:     string
  ts:          string
  lat:         number
  lng:         number
  accuracy_m:  number | null
  speed_ms:    number | null
  heading:     number | null
  altitude_m:  number | null
  accel_rms:   number | null
}

function bufferLer(): PontoBuffer[] {
  try {
    return JSON.parse(MMKV_STORAGE.getString('buffer') ?? '[]')
  } catch { return [] }
}

function bufferSalvar(pontos: PontoBuffer[]) {
  MMKV_STORAGE.set('buffer', JSON.stringify(pontos))
}

function bufferAdicionar(ponto: PontoBuffer) {
  const buf = bufferLer()
  buf.push(ponto)
  bufferSalvar(buf)
  if (buf.length >= FLUSH_A_CADA_PONTOS) flushBuffer()
}

// ─── Flush para Supabase ─────────────────────────────────────────────────────

async function flushBuffer() {
  const buf = bufferLer()
  if (buf.length === 0) return

  const net = await NetInfo.fetch()
  if (!net.isConnected) return

  const { error } = await supabase
    .from('lider_telemetria_pontos')
    .insert(buf)

  if (!error) {
    bufferSalvar([])
  }
}

// ─── Cálculo RMS acelerômetro ────────────────────────────────────────────────

function calcularRms(valores: number[]): number | null {
  if (valores.length === 0) return null
  const sumSq = valores.reduce((acc, v) => acc + v * v, 0)
  return Math.sqrt(sumSq / valores.length)
}

// ─── Iniciar escuta de acelerômetro ─────────────────────────────────────────

function iniciarAcelerometro() {
  Accelerometer.setUpdateInterval(100)  // 10 Hz
  accelSub = Accelerometer.addListener(({ z }) => {
    accelZ.push(z)
    // Mantém apenas últimos 10 valores (~1s a 10Hz)
    if (accelZ.length > 10) accelZ.shift()
  })
}

function pararAcelerometro() {
  accelSub?.remove()
  accelSub = null
  accelZ = []
}

// ─── Decidir intervalo de sampling ──────────────────────────────────────────

function intervaloParaVelocidade(speedMs: number | null): number {
  if (speedMs == null || speedMs < 0.55) return INTERVALO_PARADO_MS   // < 2 km/h
  if (speedMs < 4.17)                    return INTERVALO_DEVAGAR_MS  // < 15 km/h
  return INTERVALO_RAPIDO_MS
}

// ─── Gravar ponto GPS ────────────────────────────────────────────────────────

function gravarPonto(loc: Location.LocationObject) {
  if (!sessaoId || !workspaceId || !userId) return

  const agora  = Date.now()
  const speed  = loc.coords.speed ?? null
  const heading = loc.coords.heading ?? null

  // Adaptive sampling: pula se intervalo mínimo não passou
  const intervalo = intervaloParaVelocidade(speed)
  const deltaHeading = heading != null ? Math.abs(heading - ultimoHeading) : 0
  const curva = deltaHeading > 15

  if (!curva && agora - ultimoTs < intervalo) return

  ultimoTs = agora
  if (heading != null) ultimoHeading = heading

  const rms = calcularRms([...accelZ])
  accelZ = []  // limpa janela após usar

  const ponto: PontoBuffer = {
    sessao_id:   sessaoId,
    workspace_id: workspaceId,
    user_id:     userId,
    ts:          new Date(loc.timestamp).toISOString(),
    lat:         loc.coords.latitude,
    lng:         loc.coords.longitude,
    accuracy_m:  loc.coords.accuracy ?? null,
    speed_ms:    speed,
    heading:     heading,
    altitude_m:  loc.coords.altitude ?? null,
    accel_rms:   rms,
  }

  bufferAdicionar(ponto)
}

// ─── Background Task ─────────────────────────────────────────────────────────

TaskManager.defineTask(TASK_NAME, ({ data, error }: any) => {
  if (error) return
  const locations: Location.LocationObject[] = data?.locations ?? []
  locations.forEach(gravarPonto)
})

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Inicia a sessão de telemetria.
 * Chamado ao abrir o app, após autenticação do líder.
 */
export async function iniciarTelemetria(params: {
  userId:      string
  workspaceId: string
}) {
  userId      = params.userId
  workspaceId = params.workspaceId

  // Solicita permissão de localização
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return

  await Location.requestBackgroundPermissionsAsync()

  // Cria sessão no banco (ou tenta enviar pendente do MMKV)
  const sessaoPendente = MMKV_STORAGE.getString('sessao_pendente')
  if (sessaoPendente) {
    sessaoId = sessaoPendente
  } else {
    const { data, error } = await supabase
      .from('lider_telemetria_sessoes')
      .insert({ workspace_id: workspaceId, user_id: userId })
      .select('id')
      .single()

    if (error || !data) return
    sessaoId = data.id
    MMKV_STORAGE.set('sessao_pendente', sessaoId)
  }

  iniciarAcelerometro()

  // Inicia background location
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy:          Location.Accuracy.BestForNavigation,
    distanceInterval:  5,      // mínimo 5m entre pontos (evita spam parado)
    timeInterval:      5_000,  // mínimo 5s
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'SmartLíder',
      notificationBody:  'Registrando jornada de campo',
      notificationColor: '#1e40af',
    },
  })
}

/**
 * Finaliza a sessão de telemetria.
 * Chamado ao fechar/sair do app (AppState 'background' prolongado).
 */
export async function finalizarTelemetria() {
  if (!sessaoId) return

  // Para capturas
  await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => {})
  pararAcelerometro()

  // Flush final dos pontos pendentes
  await flushBuffer()

  // Fecha sessão com métricas resumidas
  const buf = bufferLer()  // pontos que não foram para o banco ainda
  await supabase
    .from('lider_telemetria_sessoes')
    .update({ finalizado_em: new Date().toISOString() })
    .eq('id', sessaoId)

  // Limpa estado local
  MMKV_STORAGE.delete('sessao_pendente')
  sessaoId    = null
  workspaceId = null
  userId      = null
}

/**
 * Forçar flush manual (ex: ao retornar a rede).
 */
export { flushBuffer as flushTelemetria }
