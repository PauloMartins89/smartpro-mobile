// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

const CRITERIOS = [
  { key: 'presenca',      label: 'Presenca e Pontualidade' },
  { key: 'produtividade', label: 'Produtividade' },
  { key: 'qualidade',     label: 'Qualidade do Trabalho' },
  { key: 'seguranca',     label: 'Seguranca' },
  { key: 'uso_epi',       label: 'Uso de EPI' },
  { key: 'disciplina',    label: 'Disciplina' },
]

function StarPicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      {[1,2,3,4,5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Text style={{ fontSize: 28 }}>{n <= value ? '★' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function AvaliacaoEquipeScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [notas,    setNotas]    = useState({ presenca: 5, produtividade: 5, qualidade: 5, seguranca: 5, uso_epi: 5, disciplina: 5 })
  const [obs,      setObs]      = useState('')

  useEffect(() => { nav.setOptions({ title: 'Avaliacao da Equipe' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_avaliacoes_equipe')
      .select('id, nota_geral, presenca, produtividade, qualidade, seguranca, uso_epi, disciplina, comentario, created_at')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  const mediaGeral  = records.length ? records.reduce((s, r) => s + (r.nota_geral ?? 0), 0) / records.length : 0
  const pendentes   = queue.filter(r => r.table === 'lider_avaliacoes_equipe').length
  const mediaNotas  = Object.values(notas).reduce((s, v) => s + v, 0) / 6

  async function handleSalvar() {
    if (!turnoAtivo) return
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const id = uuidv4()
    const nota_geral = Math.round(mediaNotas * 10) / 10
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      equipe_id: turnoAtivo.equipe_id, equipe_nome: turnoAtivo.equipe_nome,
      ...notas, nota_geral, comentario: obs,
    }
    try {
      const { error } = await supabase.from('lider_avaliacoes_equipe').upsert(payload, { onConflict: 'turno_id,equipe_id' })
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_avaliacoes_equipe', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ ...payload, sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setNotas({ presenca: 5, produtividade: 5, qualidade: 5, seguranca: 5, uso_epi: 5, disciplina: 5 })
      setObs('')
    }
  }

  function NotaStars({ nota }) {
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1,2,3,4,5].map(n => (
          <Text key={n} style={{ fontSize: 14, color: n <= nota ? '#f59e0b' : C.border }}>★</Text>
        ))}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Avaliacoes"  value={records.length}       icon="star-outline"          color={C.primary} bg={C.greenBg}  />
        <StatCard label="Media geral" value={mediaGeral.toFixed(1)} icon="trophy-outline"        color={C.blue}    bg={C.blueBg}   />
        <StatCard label="Equipe"      value={turnoAtivo?.equipe_nome ?? '?'} icon="people-outline" color={C.purple} bg={C.purpleBg} />
        <StatCard label="Offline"     value={pendentes}            icon="cloud-offline-outline" color={C.yellow}  bg={C.yellowBg} />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Avaliacoes do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Avaliar</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="star-outline" msg="Nenhuma avaliacao registrada neste turno" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.iconDot, { backgroundColor: C.greenBg }]}>
                <Ionicons name="star-outline" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rowTitle}>Nota geral: {item.nota_geral?.toFixed(1) ?? '?'}</Text>
                <Text style={s.rowSub}>{fmtDate(item.created_at?.split('T')[0])}</Text>
              </View>
              <NotaStars nota={Math.round(item.nota_geral ?? 0)} />
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Avaliar Equipe</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {CRITERIOS.map(({ key, label }) => (
                <View key={key} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</Text>
                  <StarPicker value={notas[key]} onChange={v => setNotas(prev => ({ ...prev, [key]: v }))} />
                </View>
              ))}
              <View style={{ backgroundColor: C.greenBg, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: C.textSub }}>Media calculada</Text>
                <Text style={{ fontSize: 28, fontWeight: '800', color: C.primary }}>{mediaNotas.toFixed(1)}</Text>
              </View>
              <Section label="Observacao geral">
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={obs} onChangeText={setObs} multiline placeholder="Pontos positivos, melhorias..." placeholderTextColor={C.textMuted} />
              </Section>
              <TouchableOpacity style={s.saveBtn} onPress={handleSalvar} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTx}>Salvar Avaliacao</Text>}
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