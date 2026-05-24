import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

interface MaquinaRow {
  id?: string
  maquina_id: string
  codigo: string
  modelo: string
  horimetro_inicio: string
  horimetro_fim: string
  atividade: string
  talhao_id: string
  talhao_nome: string
  observacao: string
}

interface Talhao { id: string; codigo: string; nome: string }

export default function MaquinaScreen() {
  const nav        = useNavigation()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)
  const [rows,    setRows]    = useState<MaquinaRow[]>([])
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Apontamento de Máquina' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const workspaceId = useLiderStore.getState().workspaceId

    const [{ data: maquinas }, { data: lancados }, { data: tals }] = await Promise.all([
      supabase.from('lider_maquinas').select('id, codigo, modelo').eq('workspace_id', workspaceId).eq('ativo', true).order('codigo'),
      supabase.from('lider_apontamentos_maquina').select('*').eq('turno_id', turnoAtivo.id),
      supabase.from('lider_talhoes').select('id, codigo, nome').eq('workspace_id', workspaceId).order('codigo'),
    ])

    setTalhoes(tals ?? [])
    const mapa = Object.fromEntries((lancados ?? []).map(l => [l.maquina_id, l]))

    setRows((maquinas ?? []).map(m => ({
      id:               mapa[m.id]?.id,
      maquina_id:       m.id,
      codigo:           m.codigo ?? '',
      modelo:           m.modelo ?? '',
      horimetro_inicio: String(mapa[m.id]?.horimetro_inicio ?? ''),
      horimetro_fim:    String(mapa[m.id]?.horimetro_fim    ?? ''),
      atividade:        mapa[m.id]?.atividade    ?? '',
      talhao_id:        mapa[m.id]?.talhao_id    ?? '',
      talhao_nome:      (tals ?? []).find(t => t.id === mapa[m.id]?.talhao_id)?.codigo ?? '',
      observacao:       mapa[m.id]?.observacao   ?? '',
    })))
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  function update(idx: number, patch: Partial<MaquinaRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  async function handleSalvar() {
    if (!turnoAtivo) return
    const { data: user } = await supabase.auth.getUser()
    setSaving(true)

    const upserts = rows
      .filter(r => r.horimetro_inicio || r.horimetro_fim)
      .map(r => ({
        id:               r.id,
        turno_id:         turnoAtivo.id,
        maquina_id:       r.maquina_id,
        horimetro_inicio: parseFloat(r.horimetro_inicio) || null,
        horimetro_fim:    parseFloat(r.horimetro_fim)    || null,
        horas_trabalhadas: (parseFloat(r.horimetro_fim) || 0) - (parseFloat(r.horimetro_inicio) || 0),
        atividade:        r.atividade,
        talhao_id:        r.talhao_id || null,
        observacao:       r.observacao,
        criado_por:       user.user?.id,
      }))

    if (upserts.length === 0) { Alert.alert('Atenção', 'Informe ao menos o horímetro de uma máquina'); setSaving(false); return }

    const { error } = await supabase.from('lider_apontamentos_maquina').upsert(upserts, { onConflict: 'turno_id,maquina_id' })
    if (error) Alert.alert('Erro', error.message)
    else       Alert.alert('Sucesso', 'Apontamentos salvos!')
    setSaving(false)
    carregar()
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {rows.map((row, idx) => {
          const horas = (parseFloat(row.horimetro_fim) || 0) - (parseFloat(row.horimetro_inicio) || 0)
          return (
            <View key={row.maquina_id} style={styles.card}>
              <Text style={styles.cardTitle}>{row.codigo} · {row.modelo}</Text>

              <View style={styles.row2}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Horímetro Início</Text>
                  <TextInput style={styles.input} value={row.horimetro_inicio} onChangeText={v => update(idx, { horimetro_inicio: v })} keyboardType="numeric" placeholder="0.0" placeholderTextColor={C.textMuted} />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Horímetro Fim</Text>
                  <TextInput style={styles.input} value={row.horimetro_fim} onChangeText={v => update(idx, { horimetro_fim: v })} keyboardType="numeric" placeholder="0.0" placeholderTextColor={C.textMuted} />
                </View>
              </View>

              {horas > 0 && <Text style={styles.horaCalc}>{horas.toFixed(1)} horas trabalhadas</Text>}

              <Text style={styles.label}>Atividade</Text>
              <TextInput style={styles.input} value={row.atividade} onChangeText={v => update(idx, { atividade: v })} placeholder="Ex: Pulverização" placeholderTextColor={C.textMuted} />

              <Text style={styles.label}>Talhão</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {talhoes.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.talhaoChip, row.talhao_id === t.id && styles.talhaoChipActive]}
                    onPress={() => update(idx, { talhao_id: t.id, talhao_nome: t.codigo })}
                  >
                    <Text style={[styles.talhaoLabel, row.talhao_id === t.id && styles.talhaoLabelActive]}>{t.codigo}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSalvar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar Apontamentos</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:             { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardTitle:        { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  row2:             { flexDirection: 'row', gap: 10, marginBottom: 8 },
  halfField:        { flex: 1 },
  label:            { fontSize: 11, fontWeight: '600', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:            { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.text, backgroundColor: C.bgMuted, marginBottom: 8 },
  horaCalc:         { fontSize: 12, color: C.greenText, fontWeight: '700', marginBottom: 8 },
  talhaoChip:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, backgroundColor: C.bgMuted },
  talhaoChipActive: { borderColor: C.primary, backgroundColor: C.greenBg },
  talhaoLabel:      { fontSize: 12, fontWeight: '600', color: C.textSub },
  talhaoLabelActive:{ color: C.primaryDark },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:              { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:          { color: '#fff', fontWeight: '700', fontSize: 15 },
})
