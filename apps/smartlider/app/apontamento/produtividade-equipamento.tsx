// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import useSyncStore from '../../src/store/useSyncStore'
import useLookupCache from '../../src/store/useLookupCache'
import { C, fmtDate } from '../../src/lib/theme'
import { StatCard, StatusChip, SyncBanner, Section, EmptyList } from '../../src/components/ModuleShared'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export default function ProdutividadeEquipamentoScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,  setRecords]  = useState([])
  const [maquinas, setMaquinas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [maq,      setMaq]      = useState(null)
  const [atividade, setAtividade] = useState('')
  const [areaHa,   setAreaHa]   = useState('')
  const [qtdAplic, setQtdAplic] = useState('')
  const [unidAplic, setUnidAplic] = useState('')
  const [horas,    setHoras]    = useState('')
  const [obs,      setObs]      = useState('')

  const UNIDADES = ['L/ha', 'kg/ha', 'sc/ha', 'ton/ha']

  useEffect(() => { nav.setOptions({ title: 'Produtividade Equipamento' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_produtividade_equipamento')
      .select('id, maquina_nome, atividade, area_ha, horas_trabalhadas, produtividade_hah, created_at, lider_maquinas(nome)')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [turnoAtivo?.id])

  const lookupCache = useLookupCache()

  useEffect(() => {
    const key = `maquinas:${workspaceId}`
    const cached = lookupCache.get(key); if (cached.length) setMaquinas(cached)
    supabase.from('lider_maquinas').select('id, nome, codigo, tipo')
      .eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setMaquinas(data); lookupCache.set(key, data) } })
      .catch(() => {})
    carregar()
  }, [carregar])

  const totalAreaHa = records.reduce((s, r) => s + (r.area_ha ?? 0), 0)
  const totalHoras  = records.reduce((s, r) => s + (r.horas_trabalhadas ?? 0), 0)
  const prodMedia   = records.filter(r => r.produtividade_hah).length
    ? records.reduce((s, r) => s + (r.produtividade_hah ?? 0), 0) / records.filter(r => r.produtividade_hah).length
    : 0
  const pendentes   = queue.filter(r => r.table === 'lider_produtividade_equipamento').length

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!maq)    { Alert.alert('Atencao', 'Selecione a maquina'); return }
    if (!areaHa) { Alert.alert('Atencao', 'Informe a area (ha)'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const id = uuidv4()
    const areaNum = parseFloat(areaHa) || 0
    const horasNum = parseFloat(horas) || null
    const produtividade_hah = (areaNum && horasNum) ? Math.round((areaNum / horasNum) * 100) / 100 : null
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      maquina_id: maq.id, maquina_nome: maq.nome,
      atividade: atividade || null,
      area_ha: areaNum,
      quantidade_aplicada: parseFloat(qtdAplic) || null,
      unidade_aplicada: unidAplic || null,
      horas_trabalhadas: horasNum,
      produtividade_hah,
      observacao: obs || null,
    }
    try {
      const { error } = await supabase.from('lider_produtividade_equipamento').upsert(payload, { onConflict: 'turno_id,maquina_id' })
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_produtividade_equipamento', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ id, lider_maquinas: { nome: maq.nome }, maquina_nome: maq.nome, area_ha: parseFloat(areaHa)||0, horas_trabalhadas: parseFloat(horas)||null, produtividade_hah, sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setMaq(null); setAtividade(''); setAreaHa(''); setQtdAplic(''); setUnidAplic(''); setHoras(''); setObs('')
    }
  }

  const efPrev = (parseFloat(areaHa) && parseFloat(horas)) ? Math.round((parseFloat(areaHa) / parseFloat(horas)) * 100) / 100 : null

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Area total"   value={totalAreaHa.toFixed(1)+'ha'} icon="map-outline"             color={C.primary} bg={C.greenBg}  />
        <StatCard label="Horas total"  value={totalHoras.toFixed(1)+'h'}  icon="time-outline"            color={C.blue}    bg={C.blueBg}   />
        <StatCard label="Prod. media"  value={prodMedia.toFixed(1)+'ha/h'} icon="trending-up-outline"    color={C.purple}  bg={C.purpleBg} />
        <StatCard label="Offline"      value={pendentes}                   icon="cloud-offline-outline"  color={C.yellow}  bg={C.yellowBg} />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Produtividade por maquina</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="map-outline" msg="Nenhuma produtividade registrada" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.iconDot, { backgroundColor: C.greenBg }]}>
                <Ionicons name="map-outline" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rowTitle}>{item.maquina_nome ?? item.lider_maquinas?.nome ?? '?'}</Text>
                <Text style={s.rowSub}>{item.area_ha?.toFixed(1)} ha{item.horas_trabalhadas ? ' · ' + item.horas_trabalhadas + 'h' : ''}{item.produtividade_hah ? ' · ' + item.produtividade_hah + ' ha/h' : ''}</Text>
              </View>
              {item.atividade && (
                <View style={{ backgroundColor: C.bgMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontWeight: '600', fontSize: 11, color: C.textSub }}>{item.atividade}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Produtividade Equipamento</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Section label="Maquina *">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {maquinas.map(m => (
                    <TouchableOpacity key={m.id} style={[s.chip, maq?.id === m.id && s.chipOn]} onPress={() => setMaq(m)}>
                      <Text style={[s.chipTx, maq?.id === m.id && s.chipTxOn]}>{m.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Section>
              <Section label="Atividade">
                <TextInput style={s.input} value={atividade} onChangeText={setAtividade} placeholder="Ex: Pulverizacao, Adubacao..." placeholderTextColor={C.textMuted} />
              </Section>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Section label="Area (ha) *">
                    <TextInput style={s.input} value={areaHa} onChangeText={setAreaHa} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
                <View style={{ flex: 1 }}>
                  <Section label="Horas trabalhadas">
                    <TextInput style={s.input} value={horas} onChangeText={setHoras} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Section label="Qtd. aplicada">
                    <TextInput style={s.input} value={qtdAplic} onChangeText={setQtdAplic} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
                <View style={{ flex: 1 }}>
                  <Section label="Unidade">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {UNIDADES.map(u => (
                        <TouchableOpacity key={u} style={[s.chip, unidAplic === u && s.chipOn]} onPress={() => setUnidAplic(u)}>
                          <Text style={[s.chipTx, unidAplic === u && s.chipTxOn]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </Section>
                </View>
              </View>
              {efPrev !== null && (
                <View style={{ backgroundColor: C.blueBg, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: C.textSub }}>Produtividade calculada</Text>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: C.blue }}>{efPrev} ha/h</Text>
                </View>
              )}
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