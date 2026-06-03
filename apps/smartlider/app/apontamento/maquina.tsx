// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import useSyncStore from '../../src/store/useSyncStore'
import { isClearlyOffline } from '../../src/lib/network'
import useLookupCache from '../../src/store/useLookupCache'
import { C, fmtDate } from '../../src/lib/theme'
import { StatCard, StatusChip, SyncBanner, Section, EmptyList } from '../../src/components/ModuleShared'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

const STATUS_OPTS = ['operando','parada','manutencao','aguardando']

export default function MaquinaScreen() {
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
  const [horIni,   setHorIni]   = useState('')
  const [horFim,   setHorFim]   = useState('')
  const [atividade,setAtiv]     = useState('')
  const [status,   setStatus]   = useState('operando')
  const [obs,      setObs]      = useState('')

  useEffect(() => { nav.setOptions({ title: 'Maquinas' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_apontamentos_maquina')
      .select('id, horimetro_inicio, horimetro_fim, atividade, status, created_at, lider_maquinas(nome, codigo)')
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

  const operando   = records.filter(r => r.status === 'operando' || !r.status).length
  const paradas    = records.filter(r => r.status === 'parada' || r.status === 'manutencao').length
  const horasTotal = records.reduce((s, r) => s + Math.max(0, (r.horimetro_fim ?? 0) - (r.horimetro_inicio ?? 0)), 0)
  const pendentes  = queue.filter(r => r.table === 'lider_apontamentos_maquina').length

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!maq) { Alert.alert('Atencao', 'Selecione a maquina'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const id = uuidv4()
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      maquina_id: maq.id, horimetro_inicio: parseFloat(horIni) || 0,
      horimetro_fim: parseFloat(horFim) || null,
      atividade, status, observacao: obs, criado_por: user.user?.id,
    }
    try {
      if (await isClearlyOffline()) throw new Error('offline')
      const { error } = await supabase.from('lider_apontamentos_maquina').upsert(payload, { onConflict: 'turno_id,maquina_id' })
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_apontamentos_maquina', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ id, lider_maquinas: { nome: maq.nome, codigo: maq.codigo }, horimetro_inicio: parseFloat(horIni), horimetro_fim: parseFloat(horFim), atividade, status, sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setMaq(null); setHorIni(''); setHorFim(''); setAtiv(''); setObs(''); setStatus('operando')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Operando"    value={operando}               icon="construct-outline"     color={C.primary} bg={C.greenBg}  />
        <StatCard label="Paradas"     value={paradas}                icon="stop-circle-outline"   color={C.red}     bg={C.redBg}    />
        <StatCard label="Horas total" value={horasTotal.toFixed(1)+'h'} icon="speedometer-outline" color={C.blue}  bg={C.blueBg}   />
        <StatCard label="Offline"     value={pendentes}              icon="cloud-offline-outline" color={C.yellow}  bg={C.yellowBg} />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Maquinas do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="construct-outline" msg="Nenhuma maquina apontada neste turno" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.iconDot, { backgroundColor: item.status === 'operando' ? C.greenBg : C.redBg }]}>
                <Ionicons name="construct-outline" size={16} color={item.status === 'operando' ? C.green : C.red} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rowTitle}>{item.lider_maquinas?.nome ?? item.lider_maquinas?.codigo ?? '?'}</Text>
                <Text style={s.rowSub}>{item.atividade || 'sem atividade'} · {Math.max(0, (item.horimetro_fim ?? 0) - (item.horimetro_inicio ?? 0)).toFixed(1)}h</Text>
              </View>
              <StatusChip status={item.status ?? 'operando'} size="sm" />
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Apontamento de Maquina</Text>
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
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Section label="Horimetro Inicio">
                    <TextInput style={s.input} value={horIni} onChangeText={setHorIni} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
                <View style={{ flex: 1 }}>
                  <Section label="Horimetro Fim">
                    <TextInput style={s.input} value={horFim} onChangeText={setHorFim} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
              </View>
              <Section label="Atividade">
                <TextInput style={s.input} value={atividade} onChangeText={setAtiv} placeholder="Ex: Pulverizacao, Plantio..." placeholderTextColor={C.textMuted} />
              </Section>
              <Section label="Status">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {STATUS_OPTS.map(st => (
                    <TouchableOpacity key={st} style={[s.chip, status === st && s.chipOn]} onPress={() => setStatus(st)}>
                      <Text style={[s.chipTx, status === st && s.chipTxOn]}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
              <Section label="Observacao">
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={obs} onChangeText={setObs} multiline placeholder="Obs..." placeholderTextColor={C.textMuted} />
              </Section>
              <TouchableOpacity style={s.saveBtn} onPress={handleSalvar} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTx}>Salvar Apontamento</Text>}
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
  saveBtn:     { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveTx:      { color: '#fff', fontWeight: '800', fontSize: 15 },
  iconDot:     { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  starRow:     { flexDirection: 'row', gap: 6, marginBottom: 4 },
  star:        { fontSize: 28 },
})