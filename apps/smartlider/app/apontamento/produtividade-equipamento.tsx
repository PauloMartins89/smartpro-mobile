import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

interface MaquinaRow {
  maquina_id:   string
  codigo:       string
  modelo:       string
  ha_realizado: string
  ha_meta:      string
  horasOp:      string
  obs:          string
  salvo:        boolean
}

export default function ProdutividadeEquipamentoScreen() {
  const nav        = useNavigation()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)
  const [rows,    setRows]    = useState<MaquinaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Produtividade Equipamento' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const workspaceId = useLiderStore.getState().workspaceId

    const [{ data: maquinas }, { data: lancados }] = await Promise.all([
      supabase.from('lider_maquinas').select('id, codigo, modelo')
        .eq('workspace_id', workspaceId).eq('ativo', true).order('codigo'),
      supabase.from('lider_produtividade_equipamento').select('*')
        .eq('turno_id', turnoAtivo.id),
    ])

    const mapa = Object.fromEntries((lancados ?? []).map((l: any) => [l.maquina_id, l]))

    setRows((maquinas ?? []).map((m: any) => {
      const l = mapa[m.id]
      return {
        maquina_id:   m.id,
        codigo:       m.codigo,
        modelo:       m.modelo,
        ha_realizado: l?.ha_realizado != null ? String(l.ha_realizado) : '',
        ha_meta:      l?.ha_meta      != null ? String(l.ha_meta)      : '',
        horasOp:      l?.horas_operacao != null ? String(l.horas_operacao) : '',
        obs:          l?.observacao ?? '',
        salvo:        !!l,
      }
    }))
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  function update(idx: number, field: keyof MaquinaRow, val: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val, salvo: false } : r))
  }

  async function handleSalvar() {
    if (!turnoAtivo) return
    const preenchidos = rows.filter(r => r.ha_realizado || r.ha_meta || r.horasOp)
    if (!preenchidos.length) { Alert.alert('Atenção', 'Preencha ao menos um equipamento'); return }

    setSaving(true)
    const workspaceId = useLiderStore.getState().workspaceId

    const upserts = preenchidos.map(r => ({
      turno_id:       turnoAtivo.id,
      workspace_id:   workspaceId,
      maquina_id:     r.maquina_id,
      ha_realizado:   r.ha_realizado   ? parseFloat(r.ha_realizado)  : null,
      ha_meta:        r.ha_meta        ? parseFloat(r.ha_meta)       : null,
      horas_operacao: r.horasOp        ? parseFloat(r.horasOp)       : null,
      observacao:     r.obs || null,
    }))

    const { error } = await supabase.from('lider_produtividade_equipamento').upsert(upserts, {
      onConflict: 'turno_id,maquina_id',
    })

    setSaving(false)
    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      setRows(prev => prev.map(r => ({ ...r, salvo: true })))
      Alert.alert('Salvo', 'Produtividade dos equipamentos registrada.')
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum equipamento cadastrado</Text>
          </View>
        ) : rows.map((row, idx) => {
          const efic = row.ha_meta && row.ha_realizado && parseFloat(row.ha_meta) > 0
            ? Math.round((parseFloat(row.ha_realizado) / parseFloat(row.ha_meta)) * 100) : null
          const cor  = efic == null ? C.textMuted : efic >= 100 ? C.green : efic >= 70 ? C.yellow : C.red

          return (
            <View key={row.maquina_id} style={[styles.card, row.salvo && styles.cardSalvo]}>
              <View style={styles.cardHeader}>
                <Text style={styles.codigo}>{row.codigo}</Text>
                <Text style={styles.modelo}>{row.modelo}</Text>
                {row.salvo && <Text style={styles.badge}>✓ Salvo</Text>}
              </View>

              <View style={styles.row3}>
                <View style={styles.field}>
                  <Text style={styles.label}>Meta (ha)</Text>
                  <TextInput
                    style={styles.input}
                    value={row.ha_meta}
                    onChangeText={v => update(idx, 'ha_meta', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Realizado (ha)</Text>
                  <TextInput
                    style={styles.input}
                    value={row.ha_realizado}
                    onChangeText={v => update(idx, 'ha_realizado', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Horas op.</Text>
                  <TextInput
                    style={styles.input}
                    value={row.horasOp}
                    onChangeText={v => update(idx, 'horasOp', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
              </View>

              {efic != null && (
                <View style={styles.eficRow}>
                  <View style={styles.eficBar}>
                    <View style={[styles.eficFill, { width: `${Math.min(efic, 100)}%` as any, backgroundColor: cor }]} />
                  </View>
                  <Text style={[styles.eficPct, { color: cor }]}>{efic}%</Text>
                </View>
              )}

              <TextInput
                style={styles.obs}
                value={row.obs}
                onChangeText={v => update(idx, 'obs', v)}
                placeholder="Observações (opcional)"
                placeholderTextColor={C.textMuted}
                multiline
              />
            </View>
          )
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={handleSalvar} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Salvar Produtividade</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 100 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: C.textMuted, fontSize: 15 },

  card:      { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardSalvo: { borderColor: C.primary },
  cardHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  codigo:    { fontSize: 14, fontWeight: '700', color: C.text, marginRight: 8 },
  modelo:    { fontSize: 13, color: C.textSub, flex: 1 },
  badge:     { fontSize: 11, color: C.primary, fontWeight: '600' },

  row3:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  field: { flex: 1 },
  label: { fontSize: 10, fontWeight: '600', color: C.textSub, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.text, backgroundColor: C.bgMuted },

  eficRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  eficBar:  { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bgMuted, overflow: 'hidden' },
  eficFill: { height: 6, borderRadius: 3 },
  eficPct:  { fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'right' },

  obs: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.text, backgroundColor: C.bgMuted, minHeight: 44 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border },
  btn:    { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
})
