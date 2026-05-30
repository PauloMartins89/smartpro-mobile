// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, Image } from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
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

const STATUS_OPTS = ['entregue','pendente','vencendo','vencido']
const MOTIVO_OPTS = ['Primeiro fornecimento','Reposicao','Substituicao por dano','EPI vencido']

export default function ControleEpiScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,       setRecords]   = useState([])
  const [colaboradores, setColabs]    = useState([])
  const [epis,          setEpis]      = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [colab,    setColab]    = useState(null)
  const [epi,      setEpi]      = useState(null)
  const [motivo,   setMotivo]   = useState(MOTIVO_OPTS[0])
  const [validade, setValidade] = useState('')
  const [status,   setStatus]   = useState('entregue')
  const [fotoUri,  setFotoUri]  = useState(null)
  const [obs,      setObs]      = useState('')

  useEffect(() => { nav.setOptions({ title: 'Controle de EPI' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_controle_epi')
      .select('id, status, motivo, validade, foto_url, created_at, lider_colaboradores(nome), lider_epis(nome)')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [turnoAtivo?.id])

  const lookupCache = useLookupCache()

  useEffect(() => {
    const kColabs = `colaboradores:${turnoAtivo?.equipe_id}`
    const kEpis   = `epis:${workspaceId}`
    const cc = lookupCache.get(kColabs); if (cc.length) setColabs(cc)
    const ce = lookupCache.get(kEpis);   if (ce.length) setEpis(ce)
    supabase.from('lider_colaboradores').select('id, nome, cargo').eq('equipe_id', turnoAtivo?.equipe_id ?? '').eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setColabs(data); lookupCache.set(kColabs, data) } })
      .catch(() => {})
    supabase.from('lider_epis').select('id, nome, ca').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setEpis(data); lookupCache.set(kEpis, data) } })
      .catch(() => {})
    carregar()
  }, [carregar])

  const entregues  = records.filter(r => r.status === 'entregue').length
  const vencendo   = records.filter(r => r.status === 'vencendo').length
  const vencidos   = records.filter(r => r.status === 'vencido').length
  const pendentes  = queue.filter(r => r.table === 'lider_controle_epi').length

  async function pickFoto() {
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync()
    if (perm !== 'granted') { Alert.alert('Permissao negada'); return }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false })
    if (!res.canceled) setFotoUri(res.assets[0].uri)
  }

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!colab) { Alert.alert('Atencao', 'Selecione o colaborador'); return }
    if (!epi)   { Alert.alert('Atencao', 'Selecione o EPI'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    let foto_url = null
    if (fotoUri) {
      const ext = fotoUri.split('.').pop()
      const fileName = uuidv4() + '.' + ext
      const resp = await fetch(fotoUri)
      const blob = await resp.blob()
      const { data: up } = await supabase.storage.from('lider-fotos').upload('epi/' + fileName, blob, { contentType: 'image/' + ext })
      if (up) {
        const { data: urlData } = supabase.storage.from('lider-fotos').getPublicUrl('epi/' + fileName)
        foto_url = urlData.publicUrl
      }
    }
    const id = uuidv4()
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      colaborador_id: colab.id, epi_id: epi.id, motivo, validade: validade || null,
      status, foto_url, observacao: obs, criado_por: user.user?.id,
    }
    try {
      const { error } = await supabase.from('lider_controle_epi').insert(payload)
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_controle_epi', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ id, lider_colaboradores: { nome: colab.nome }, lider_epis: { nome: epi.nome }, status, motivo, created_at: new Date().toISOString(), sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setColab(null); setEpi(null); setMotivo(MOTIVO_OPTS[0]); setValidade(''); setFotoUri(null); setObs(''); setStatus('entregue')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Entregues"  value={entregues}  icon="shield-checkmark-outline" color={C.primary} bg={C.greenBg}  />
        <StatCard label="Vencendo"   value={vencendo}   icon="warning-outline"          color={C.yellow}  bg={C.yellowBg} />
        <StatCard label="Vencidos"   value={vencidos}   icon="close-circle-outline"     color={C.red}     bg={C.redBg}    />
        <StatCard label="Offline"    value={pendentes}  icon="cloud-offline-outline"    color={C.blue}    bg={C.blueBg}   />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Controle do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="shield-checkmark-outline" msg="Nenhum EPI registrado neste turno" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.iconDot, { backgroundColor: item.status === 'entregue' ? C.greenBg : item.status === 'vencido' ? C.redBg : C.yellowBg }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={item.status === 'entregue' ? C.green : item.status === 'vencido' ? C.red : C.yellow} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rowTitle}>{item.lider_colaboradores?.nome ?? '?'}</Text>
                <Text style={s.rowSub}>{item.lider_epis?.nome ?? '?'} · {item.motivo}</Text>
              </View>
              <StatusChip status={item.status ?? 'pendente'} size="sm" />
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Registro de EPI</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Section label="Colaborador *">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {colaboradores.map(c => (
                    <TouchableOpacity key={c.id} style={[s.chip, colab?.id === c.id && s.chipOn]} onPress={() => setColab(c)}>
                      <Text style={[s.chipTx, colab?.id === c.id && s.chipTxOn]}>{c.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Section>
              <Section label="EPI *">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {epis.map(e => (
                    <TouchableOpacity key={e.id} style={[s.chip, epi?.id === e.id && s.chipOn]} onPress={() => setEpi(e)}>
                      <Text style={[s.chipTx, epi?.id === e.id && s.chipTxOn]}>{e.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Section>
              <Section label="Motivo">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {MOTIVO_OPTS.map(m => (
                    <TouchableOpacity key={m} style={[s.chip, motivo === m && s.chipOn]} onPress={() => setMotivo(m)}>
                      <Text style={[s.chipTx, motivo === m && s.chipTxOn]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
              <Section label="Validade do EPI">
                <TextInput style={s.input} value={validade} onChangeText={setValidade} placeholder="DD/MM/AAAA" placeholderTextColor={C.textMuted} />
              </Section>
              <Section label="Status">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {STATUS_OPTS.map(st => (
                    <TouchableOpacity key={st} style={[s.chip, status === st && s.chipOn]} onPress={() => setStatus(st)}>
                      <Text style={[s.chipTx, status === st && s.chipTxOn]}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
              <Section label="Foto (opcional)">
                <TouchableOpacity style={[s.input, { alignItems: 'center', justifyContent: 'center', height: 50 }]} onPress={pickFoto}>
                  <Text style={{ color: C.primary, fontWeight: '600' }}>{fotoUri ? 'Foto selecionada - trocar' : 'Tirar foto'}</Text>
                </TouchableOpacity>
                {fotoUri && <Image source={{ uri: fotoUri }} style={{ width: '100%', height: 120, borderRadius: 10, marginTop: 8 }} resizeMode="cover" />}
              </Section>
              <Section label="Observacao">
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={obs} onChangeText={setObs} multiline placeholder="Obs..." placeholderTextColor={C.textMuted} />
              </Section>
              <TouchableOpacity style={s.saveBtn} onPress={handleSalvar} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTx}>Salvar Registro EPI</Text>}
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