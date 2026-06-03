// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  TextInput, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import useLiderStore from '../store/useLiderStore'
import { C } from '../lib/theme'

type Condicao = 'sol' | 'parcial' | 'nublado' | 'chuva' | 'tempestade' | 'vento_forte'

const CONDICOES: { key: Condicao; emoji: string; label: string; bg: string; color: string; border: string }[] = [
  { key: 'sol',          emoji: '☀️',  label: 'Sol',         bg: '#FEFCE8', color: '#A16207', border: '#FDE68A' },
  { key: 'parcial',      emoji: '🌤',  label: 'P. Nublado',  bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' },
  { key: 'nublado',      emoji: '☁️',  label: 'Nublado',     bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  { key: 'chuva',        emoji: '🌧',  label: 'Chuva',       bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  { key: 'tempestade',   emoji: '⛈',  label: 'Tempestade',  bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  { key: 'vento_forte',  emoji: '💨',  label: 'Vento Forte', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
]

interface ClimaData {
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
  const [clima,  setClima]  = useState<ClimaData | null>(null)
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [form,   setForm]   = useState<FormState>({
    condicao: 'sol', temperatura_c: '', umidade_pct: '', vento_kmh: '', precipitacao_mm: '', observacao: '',
  })

  const carregar = useCallback(async () => {
    if (!turnoAtivo?.id) return
    const { data } = await supabase
      .from('lider_condicoes_climaticas')
      .select('id, condicao, temperatura_c, umidade_pct, vento_kmh, precipitacao_mm, observacao')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setClima(data)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  function abrirForm() {
    setForm({
      condicao:        clima?.condicao        ?? 'sol',
      temperatura_c:   clima?.temperatura_c   != null ? String(clima.temperatura_c)   : '',
      umidade_pct:     clima?.umidade_pct     != null ? String(clima.umidade_pct)     : '',
      vento_kmh:       clima?.vento_kmh       != null ? String(clima.vento_kmh)       : '',
      precipitacao_mm: clima?.precipitacao_mm != null ? String(clima.precipitacao_mm) : '',
      observacao:      clima?.observacao      ?? '',
    })
    setOpen(true)
  }

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
    if (data) setClima(data)
    setSaving(false)
    setOpen(false)
  }

  if (!turnoAtivo) return null

  const cond        = clima ? CONDICOES.find(c => c.key === clima.condicao) : null
  const alertaVento = clima?.vento_kmh != null && Number(clima.vento_kmh) > 15
  const alertaForm  = form.vento_kmh !== '' && Number(form.vento_kmh) > 15

  return (
    <>
      {/* ── Badge inline ─────────────────────────────────── */}
      <TouchableOpacity
        style={[st.badge, cond ? { backgroundColor: cond.bg, borderColor: cond.border } : null]}
        onPress={abrirForm}
        activeOpacity={0.85}
      >
        <View style={st.badgeInner}>
          {clima ? (
            <>
              <Text style={st.emoji}>{cond?.emoji}</Text>
              <Text style={[st.condTxt, { color: cond?.color }]}>{cond?.label}</Text>
              {clima.temperatura_c != null && <Text style={[st.metaTxt, { color: cond?.color }]}>  {clima.temperatura_c}°C</Text>}
              {clima.umidade_pct   != null && <Text style={[st.metaTxt, { color: cond?.color }]}>· {clima.umidade_pct}%</Text>}
              {clima.vento_kmh     != null && <Text style={[st.metaTxt, { color: cond?.color }]}>· {clima.vento_kmh} km/h</Text>}
              {alertaVento && (
                <View style={st.alertaPill}>
                  <Ionicons name="warning" size={10} color="#C2410C" />
                  <Text style={st.alertaPillTxt}>Restr. pulv.</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Ionicons name="partly-sunny-outline" size={14} color={C.textSub} />
              <Text style={st.emptyTxt}>Adicionar condição climática</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-down" size={13} color={cond?.color ?? C.textMuted} />
      </TouchableOpacity>

      {/* ── Bottom sheet ─────────────────────────────────── */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.overlay} onPress={() => setOpen(false)} />
        <View style={st.sheet}>
          <View style={st.handle} />
          <Text style={st.sheetTitle}>🌤  Condições Climáticas</Text>
          <Text style={st.sheetSub}>
            Turno {turnoAtivo.turno} · {turnoAtivo.data}
            {clima ? '  ·  toque para atualizar' : '  ·  primeiro registro'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Condição */}
            <Text style={st.label}>Como está o tempo?</Text>
            <View style={st.chipRow}>
              {CONDICOES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[st.chip, form.condicao === c.key && { backgroundColor: c.bg, borderColor: c.color }]}
                  onPress={() => setForm(p => ({ ...p, condicao: c.key }))}
                  activeOpacity={0.8}
                >
                  <Text style={st.chipEmoji}>{c.emoji}</Text>
                  <Text style={[st.chipLbl, form.condicao === c.key && { color: c.color, fontWeight: '700' }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Métricas */}
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

            {/* Observação */}
            <Text style={st.label}>Observação (opcional)</Text>
            <TextInput
              style={st.textarea}
              value={form.observacao}
              onChangeText={v => setForm(p => ({ ...p, observacao: v }))}
              placeholder="Ex: chuva interrompeu operação às 10h..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={st.saveBtn} onPress={salvar} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.saveTxt}>{clima ? 'Atualizar Condição' : 'Registrar Condição'}</Text>
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
  emptyTxt:     { fontSize: 12, color: C.textSub, marginLeft: 6 },
  alertaPill:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4 },
  alertaPillTxt:{ fontSize: 10, color: '#C2410C', fontWeight: '700' },
  // Sheet
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, maxHeight: '85%' },
  handle:       { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 4 },
  sheetSub:     { fontSize: 12, color: C.textSub, marginBottom: 22, textTransform: 'capitalize' },
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
