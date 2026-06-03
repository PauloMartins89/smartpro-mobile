// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  TextInput, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import useLiderStore from '../store/useLiderStore'
import { C } from '../lib/theme'

type Condicao = 'sol' | 'parcial' | 'nublado' | 'chuva' | 'tempestade' | 'vento_forte'

const CONDICOES: { key: Condicao; emoji: string; label: string; bg: string; color: string; border: string }[] = [
  { key: 'sol',         emoji: '☀️', label: 'Sol',         bg: '#FEFCE8', color: '#A16207', border: '#FDE68A' },
  { key: 'parcial',     emoji: '🌤', label: 'P. Nublado',  bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' },
  { key: 'nublado',     emoji: '☁️', label: 'Nublado',     bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  { key: 'chuva',       emoji: '🌧', label: 'Chuva',       bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  { key: 'tempestade',  emoji: '⛈', label: 'Tempestade',  bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  { key: 'vento_forte', emoji: '💨', label: 'Vento Forte', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
]

/** Mapeia WMO weather codes (Open-Meteo) → nossas condições */
function wmoParaCondicao(code: number, vento: number): Condicao {
  if (code >= 95) return 'tempestade'   // Thunderstorm
  if (code >= 51) return 'chuva'        // Drizzle / Rain
  if (code >= 45) return 'nublado'      // Fog
  if (code >= 3)  return 'nublado'      // Overcast
  if (code >= 2)  return 'parcial'      // Partly cloudy
  if (vento >= 25) return 'vento_forte' // Clear but strong wind
  return 'sol'
}

interface ApiData {
  condicao: Condicao
  temperatura_c: number
  umidade_pct: number
  vento_kmh: number
  precipitacao_mm: number
  atualizadoEm: Date
}

interface ClimaRegistro {
  id?: string
  condicao: Condicao
  temperatura_c?: number
  umidade_pct?: number
  vento_kmh?: number
  precipitacao_mm?: number
  observacao?: string
}

interface FormState {
  condicao: Condicao
  temperatura_c: string
  umidade_pct: string
  vento_kmh: string
  precipitacao_mm: string
  observacao: string
}

export default function ClimaBadge() {
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)

  const [apiData,  setApiData]  = useState<ApiData | null>(null)
  const [registro, setRegistro] = useState<ClimaRegistro | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [open,     setOpen]     = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [locError, setLocError] = useState(false)
  const [form, setForm] = useState<FormState>({
    condicao: 'sol', temperatura_c: '', umidade_pct: '', vento_kmh: '', precipitacao_mm: '', observacao: '',
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Busca coords: tenta GPS, fallback para IP ────────────────────────
  async function obterCoordenadas(): Promise<{ latitude: number; longitude: number } | null> {
    // 1. Tenta GPS nativo
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      }
    } catch { /* GPS indisponível */ }

    // 2. Fallback: geolocalização por IP (funciona no browser e quando GPS negado)
    try {
      const res  = await fetch('https://ipapi.co/json/')
      const json = await res.json()
      if (json.latitude && json.longitude) {
        return { latitude: json.latitude, longitude: json.longitude }
      }
    } catch { /* IP geolocation falhou */ }

    return null
  }

  // ── Busca clima na API Open-Meteo ─────────────────────────────────────
  const buscarClima = useCallback(async () => {
    try {
      const coords = await obterCoordenadas()
      if (!coords) { setLocError(true); setLoading(false); return }

      const { latitude, longitude } = coords
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
        `&wind_speed_unit=kmh&timezone=auto`

      const res  = await fetch(url)
      const json = await res.json()
      const cur  = json.current
      const vento = Number((cur.wind_speed_10m ?? 0).toFixed(1))

      setApiData({
        condicao:        wmoParaCondicao(cur.weather_code ?? 0, vento),
        temperatura_c:   Number((cur.temperature_2m ?? 0).toFixed(1)),
        umidade_pct:     Math.round(cur.relative_humidity_2m ?? 0),
        vento_kmh:       vento,
        precipitacao_mm: Number((cur.precipitation ?? 0).toFixed(1)),
        atualizadoEm:    new Date(),
      })
      setLocError(false)
    } catch {
      setLocError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Último registro salvo no DB ──────────────────────────────────────
  const carregarRegistro = useCallback(async () => {
    if (!turnoAtivo?.id) return
    const { data } = await supabase
      .from('lider_condicoes_climaticas')
      .select('id, condicao, temperatura_c, umidade_pct, vento_kmh, precipitacao_mm, observacao')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setRegistro(data)
  }, [turnoAtivo?.id])

  useEffect(() => {
    buscarClima()
    carregarRegistro()
    // Atualiza clima a cada 15 minutos
    intervalRef.current = setInterval(buscarClima, 15 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [buscarClima, carregarRegistro])

  // ── Abre formulário pré-preenchido com dados da API ──────────────────
  function abrirForm() {
    const base = apiData ?? registro
    setForm({
      condicao:        base?.condicao        ?? 'sol',
      temperatura_c:   base?.temperatura_c   != null ? String(base.temperatura_c)   : '',
      umidade_pct:     base?.umidade_pct     != null ? String(base.umidade_pct)     : '',
      vento_kmh:       base?.vento_kmh       != null ? String(base.vento_kmh)       : '',
      precipitacao_mm: base?.precipitacao_mm != null ? String(base.precipitacao_mm) : '',
      observacao:      registro?.observacao  ?? '',
    })
    setOpen(true)
  }

  // ── Salva registro no DB ─────────────────────────────────────────────
  async function salvar() {
    if (!turnoAtivo?.id) return
    setSaving(true)
    const payload = {
      turno_id:        turnoAtivo.id,
      workspace_id:    workspaceId,
      equipe_id:       turnoAtivo.equipe_id,
      condicao:        form.condicao,
      temperatura_c:   form.temperatura_c   !== '' ? Number(form.temperatura_c)   : null,
      umidade_pct:     form.umidade_pct     !== '' ? Number(form.umidade_pct)     : null,
      vento_kmh:       form.vento_kmh       !== '' ? Number(form.vento_kmh)       : null,
      precipitacao_mm: form.precipitacao_mm !== '' ? Number(form.precipitacao_mm) : null,
      observacao:      form.observacao || null,
    }
    const { data } = await supabase
      .from('lider_condicoes_climaticas')
      .insert(payload)
      .select('id, condicao, temperatura_c, umidade_pct, vento_kmh, precipitacao_mm, observacao')
      .single()
    if (data) setRegistro(data)
    setSaving(false)
    setOpen(false)
  }

  if (!turnoAtivo) return null

  // Badge mostra dados da API ao vivo; fallback para último registro do DB
  const display     = apiData ?? registro
  const cond        = display ? CONDICOES.find(c => c.key === display.condicao) : null
  const alertaVento = display?.vento_kmh != null && Number(display.vento_kmh) > 15
  const alertaForm  = form.vento_kmh !== '' && Number(form.vento_kmh) > 15
  const horaApi     = apiData?.atualizadoEm
    ? `${apiData.atualizadoEm.getHours().toString().padStart(2,'0')}:${apiData.atualizadoEm.getMinutes().toString().padStart(2,'0')}`
    : null

  return (
    <>
      {/* ── Badge inline ─────────────────────────────────── */}
      <TouchableOpacity
        style={[st.badge, cond ? { backgroundColor: cond.bg, borderColor: cond.border } : null]}
        onPress={abrirForm}
        activeOpacity={0.85}
      >
        <View style={st.badgeInner}>
          {loading ? (
            <>
              <ActivityIndicator size="small" color={C.textMuted} />
              <Text style={st.emptyTxt}>Buscando clima...</Text>
            </>
          ) : locError ? (
            <>
              <Ionicons name="location-outline" size={14} color={C.textMuted} />
              <Text style={st.emptyTxt}>Localização indisponível — toque para registrar</Text>
            </>
          ) : display ? (
            <>
              <Text style={st.emoji}>{cond?.emoji}</Text>
              <Text style={[st.condTxt, { color: cond?.color }]}>{cond?.label}</Text>
              {display.temperatura_c != null && <Text style={[st.metaTxt, { color: cond?.color }]}>  {display.temperatura_c}°C</Text>}
              {display.umidade_pct   != null && <Text style={[st.metaTxt, { color: cond?.color }]}>· {display.umidade_pct}%</Text>}
              {display.vento_kmh     != null && <Text style={[st.metaTxt, { color: cond?.color }]}>· {display.vento_kmh} km/h</Text>}
              {alertaVento && (
                <View style={st.alertaPill}>
                  <Ionicons name="warning" size={10} color="#C2410C" />
                  <Text style={st.alertaPillTxt}>Restr. pulv.</Text>
                </View>
              )}
              {horaApi && <Text style={[st.horaApiTxt, { color: cond?.color }]}>· {horaApi}</Text>}
            </>
          ) : (
            <>
              <Ionicons name="partly-sunny-outline" size={14} color={C.textSub} />
              <Text style={st.emptyTxt}>Sem dados de localização</Text>
            </>
          )}
        </View>
        <Ionicons name="create-outline" size={14} color={cond?.color ?? C.textMuted} />
      </TouchableOpacity>

      {/* ── Bottom sheet ─────────────────────────────────── */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.overlay} onPress={() => setOpen(false)} />
        <View style={st.sheet}>
          <View style={st.handle} />

          <View style={st.sheetHeader}>
            <View>
              <Text style={st.sheetTitle}>🌤  Condições Climáticas</Text>
              <Text style={st.sheetSub}>Turno {turnoAtivo.turno} · {turnoAtivo.data}</Text>
            </View>
            {apiData && (
              <View style={st.apiBadge}>
                <Ionicons name="location" size={11} color="#0369A1" />
                <Text style={st.apiBadgeTxt}>GPS · {horaApi}</Text>
              </View>
            )}
          </View>

          {apiData && (
            <View style={st.apiNotice}>
              <Ionicons name="information-circle-outline" size={14} color="#0369A1" />
              <Text style={st.apiNoticeTxt}>
                Preenchido automaticamente via GPS (Open-Meteo). Ajuste se necessário antes de salvar.
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={st.label}>Condição detectada</Text>
            <View style={st.chipRow}>
              {CONDICOES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[st.chip, form.condicao === c.key && { backgroundColor: c.bg, borderColor: c.color }]}
                  onPress={() => setForm(p => ({ ...p, condicao: c.key }))}
                  activeOpacity={0.8}
                >
                  <Text style={st.chipEmoji}>{c.emoji}</Text>
                  <Text style={[st.chipLbl, form.condicao === c.key && { color: c.color, fontWeight: '700' }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.metricRow}>
              <NumInput label="🌡 Temp. (°C)"   value={form.temperatura_c}   onChange={v => setForm(p => ({ ...p, temperatura_c: v }))} />
              <NumInput label="💧 Umidade (%)"  value={form.umidade_pct}     onChange={v => setForm(p => ({ ...p, umidade_pct: v }))} />
            </View>
            <View style={st.metricRow}>
              <NumInput label="💨 Vento (km/h)" value={form.vento_kmh}       onChange={v => setForm(p => ({ ...p, vento_kmh: v }))} />
              <NumInput label="🌧 Precip. (mm)" value={form.precipitacao_mm} onChange={v => setForm(p => ({ ...p, precipitacao_mm: v }))} />
            </View>

            {alertaForm && (
              <View style={st.alertaBox}>
                <Ionicons name="warning" size={16} color="#C2410C" />
                <Text style={st.alertaBoxTxt}>Vento acima de 15 km/h — Restrição de pulverização</Text>
              </View>
            )}

            <Text style={st.label}>Observação do líder (opcional)</Text>
            <TextInput
              style={st.textarea}
              value={form.observacao}
              onChangeText={v => setForm(p => ({ ...p, observacao: v }))}
              placeholder="Ex: chuva interrompeu operação às 10h, ventania no setor Norte..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={st.saveBtn} onPress={salvar} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.saveTxt}>{registro ? 'Atualizar Registro' : 'Confirmar e Salvar'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={st.numWrap}>
      <Text style={st.numLabel}>{label}</Text>
      <TextInput
        style={st.numInput}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={C.textMuted}
      />
    </View>
  )
}

const st = StyleSheet.create({
  // Badge
  badge:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  badgeInner:   { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, flexWrap: 'wrap' },
  emoji:        { fontSize: 15 },
  condTxt:      { fontSize: 13, fontWeight: '700' },
  metaTxt:      { fontSize: 12, fontWeight: '500' },
  horaApiTxt:   { fontSize: 11, opacity: 0.6 },
  emptyTxt:     { fontSize: 12, color: C.textSub, marginLeft: 6 },
  alertaPill:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4 },
  alertaPillTxt:{ fontSize: 10, color: '#C2410C', fontWeight: '700' },
  // Sheet
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, maxHeight: '85%' },
  handle:       { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sheetTitle:   { fontSize: 19, fontWeight: '800', color: C.text },
  sheetSub:     { fontSize: 12, color: C.textSub, marginTop: 2, textTransform: 'capitalize' },
  apiBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  apiBadgeTxt:  { fontSize: 11, color: '#0369A1', fontWeight: '700' },
  apiNotice:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#F0F9FF', borderRadius: 10, padding: 11, marginBottom: 18, borderWidth: 1, borderColor: '#BAE6FD' },
  apiNoticeTxt: { flex: 1, fontSize: 12, color: '#0369A1', lineHeight: 18 },
  label:        { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 10, marginTop: 4 },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgMuted },
  chipEmoji:    { fontSize: 16 },
  chipLbl:      { fontSize: 12, color: C.textSub },
  metricRow:    { flexDirection: 'row', gap: 12, marginBottom: 12 },
  numWrap:      { flex: 1 },
  numLabel:     { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6 },
  numInput:     { backgroundColor: C.bgMuted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: C.text, borderWidth: 1, borderColor: C.border, textAlign: 'center' },
  alertaBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FED7AA' },
  alertaBoxTxt: { flex: 1, fontSize: 13, color: '#C2410C', fontWeight: '600' },
  textarea:     { backgroundColor: C.bgMuted, borderRadius: 10, padding: 12, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border, minHeight: 80, marginBottom: 20, textAlignVertical: 'top' },
  saveBtn:      { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveTxt:      { color: '#fff', fontWeight: '700', fontSize: 15 },
})
