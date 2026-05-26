// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import useSyncStore from '../../src/store/useSyncStore'
import { C, fmtDate } from '../../src/lib/theme'
import { StatCard, StatusChip, SyncBanner, Section, EmptyList } from '../../src/components/ModuleShared'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export default function ProdutividadeEquipeScreen() {
  const nav         = useNavigation()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,   setRecords]  = useState([])
  const [loading,   setLoading]  = useState(true)
  const [showForm,  setShowForm] = useState(false)
  const [saving,    setSaving]   = useState(false)
  const [atividade, setAtiv]     = useState('')
  const [haMeta,    setHaMeta]   = useState('')
  const [haReal,    setHaReal]   = useState('')
  const [obs,       setObs]      = useState('')

  useEffect(() => { nav.setOptions({ title: 'Produtividade da Equipe' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_produtividade_equipe')
      .select('id, atividade, meta_ha, realizado_ha, eficiencia_pct, created_at')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  const totalReal  = records.reduce((s, r) => s + (r.realizado_ha ?? 0), 0)
  const totalMeta  = records.reduce((s, r) => s + (r.meta_ha ?? 0), 0)
  const eficiencia = totalMeta ? Math.round((totalReal / totalMeta) * 100) : 0
  const pendentes  = queue.filter(r => r.table === 'lider_produtividade_equipe').length

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!atividade) { Alert.alert('Atencao', 'Informe a atividade'); return }
    if (!haReal)    { Alert.alert('Atencao', 'Informe ha realizado'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const id = uuidv4()
    const haMR = parseFloat(haMeta) || 0
    const haRR = parseFloat(haReal) || 0
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      equipe_id: turnoAtivo.equipe_id, atividade, meta_ha: haMR, realizado_ha: haRR,
      eficiencia_pct: haMR ? Math.round((haRR / haMR) * 100) : null,
      observacao: obs, criado_por: user.user?.id,
    }
    const { error } = await supabase.from('lider_produtividade_equipe').insert(payload)
    if (error) {
      addToQueue({ id, table: 'lider_produtividade_equipe', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ ...payload, sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } else await carregar()
    setSaving(false); setShowForm(false)
    setAtiv(''); setHaMeta(''); setHaReal(''); setObs('')
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Ha realizado" value={totalReal.toFixed(1)+'ha'} icon="map-outline"           color={C.primary} bg={C.greenBg}  />
        <StatCard label="Ha meta"      value={totalMeta.toFixed(1)+'ha'} icon="flag-outline"          color={C.blue}    bg={C.blueBg}   />
        <StatCard label="Eficiencia"   value={eficiencia+'%'}            icon="trending-up-outline"   color={eficiencia >= 100 ? C.green : eficiencia >= 80 ? C.yellow : C.red} bg={C.bgMuted} />
        <StatCard label="Offline"      value={pendentes}                 icon="cloud-offline-outline" color={C.yellow}  bg={C.yellowBg} />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Atividades do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="map-outline" msg="Nenhuma atividade registrada neste turno" />}
          renderItem={({ item }) => {
            const ef = item.meta_ha ? Math.round(((item.realizado_ha ?? 0) / item.meta_ha) * 100) : null
            return (
              <View style={s.row}>
                <View style={[s.iconDot, { backgroundColor: C.greenBg }]}>
                  <Ionicons name="people-outline" size={16} color={C.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.rowTitle}>{item.atividade}</Text>
                  <Text style={s.rowSub}>{item.realizado_ha?.toFixed(1)} / {item.meta_ha?.toFixed(1)} ha</Text>
                </View>
                {ef !== null && (
                  <View style={{ backgroundColor: ef >= 100 ? C.greenBg : ef >= 80 ? C.yellowBg : C.redBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: ef >= 100 ? C.green : ef >= 80 ? C.orange : C.red }}>{ef}%</Text>
                  </View>
                )}
              </View>
            )
          }}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Produtividade da Equipe</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Section label="Atividade realizada *">
                <TextInput style={s.input} value={atividade} onChangeText={setAtiv} placeholder="Ex: Pulverizacao, Plantio..." placeholderTextColor={C.textMuted} />
              </Section>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Section label="Meta (ha)">
                    <TextInput style={s.input} value={haMeta} onChangeText={setHaMeta} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
                <View style={{ flex: 1 }}>
                  <Section label="Realizado (ha)">
                    <TextInput style={s.input} value={haReal} onChangeText={setHaReal} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
              </View>
              <Section label="Observacao">
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={obs} onChangeText={setObs} multiline placeholder="Obs..." placeholderTextColor={C.textMuted} />
              </Section>
              <TouchableOpacity style={s.saveBtn} onPress={handleSalvar} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTx}>Salvar Produtividade</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  actionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: C.text },
  newBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  row:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rowTitle:    { fontSize: 14, fontWeight: '700', color: C.text },
  rowSub:      { fontSize: 12, color: C.textSub, marginTop: 2 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal:       { backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHdr:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:  { fontSize: 16, fontWeight: '800', color: C.text },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bgMuted, marginRight: 8, marginBottom: 6 },
  chipOn:      { backgroundColor: C.primary },
  chipTx:      { fontSize: 12, fontWeight: '600', color: C.textSub },
  chipTxOn:    { color: '#fff' },
  input:       { backgroundColor: C.bgMuted, borderRadius: 10, padding: 12, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  saveBtn:     { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveTx:      { color: '#fff', fontWeight: '800', fontSize: 15 },
  iconDot:     { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  starRow:     { flexDirection: 'row', gap: 6, marginBottom: 4 },
  star:        { fontSize: 28 },
})