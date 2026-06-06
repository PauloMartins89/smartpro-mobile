// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { useNavigation } from 'expo-router'
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

const URGENCIA_OPTS = ['baixa','media','alta','urgente']
const STATUS_OPTS   = ['pendente','aprovado','reprovado','entregue']

export default function SolicitacaoInsumoScreen() {
  const nav         = useNavigation()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,  setRecords]  = useState([])
  const [produtos, setProdutos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [produto,  setProduto]  = useState(null)
  const [qtd,      setQtd]      = useState('')
  const [urgencia, setUrgencia] = useState('media')
  const [dataNec,  setDataNec]  = useState('')
  const [obs,      setObs]      = useState('')

  useEffect(() => { nav.setOptions({ title: 'Solicitar Insumo' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_solicitacoes_insumo')
      .select('id, quantidade, unidade, urgencia, status, created_at, lider_produtos(nome)')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [turnoAtivo?.id])

  const lookupCache = useLookupCache()

  useEffect(() => {
    const key = `produtos:${workspaceId}`
    const cached = lookupCache.get(key); if (cached.length) setProdutos(cached)
    supabase.from('lider_produtos').select('id, nome, unidade').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setProdutos(data); lookupCache.set(key, data) } })
      .catch(() => {})
    carregar()
  }, [carregar])

  const pendentes  = records.filter(r => r.status === 'pendente').length
  const aprovadas  = records.filter(r => r.status === 'aprovado').length
  const urgentes   = records.filter(r => r.urgencia === 'urgente').length
  const offline    = queue.filter(r => r.table === 'lider_solicitacoes_insumo').length

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!produto) { Alert.alert('Atencao', 'Selecione o produto'); return }
    if (!qtd)     { Alert.alert('Atencao', 'Informe a quantidade'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const id = uuidv4()
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      produto_id: produto.id, produto_nome: produto.nome,
      quantidade: parseFloat(qtd) || 0,
      unidade: produto.unidade, urgencia, data_necessaria: dataNec || null,
      status: 'pendente', observacao: obs,
    }
    try {
      if (await isClearlyOffline()) throw new Error('offline')
      const { error } = await supabase.from('lider_solicitacoes_insumo').insert(payload)
      if (error) throw error
      // Notifica supervisor via WhatsApp (fire-and-forget)
      fetch('https://smartpro.app.br/api/notify-lider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'insumo', id }),
      }).catch(() => {})
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_solicitacoes_insumo', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ id, lider_produtos: { nome: produto.nome }, quantidade: parseFloat(qtd), unidade: produto.unidade, urgencia, status: 'pendente', created_at: new Date().toISOString(), sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setProduto(null); setQtd(''); setDataNec(''); setObs(''); setUrgencia('media')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Pendentes" value={pendentes}  icon="time-outline"            color={C.yellow}  bg={C.yellowBg} />
        <StatCard label="Aprovadas" value={aprovadas}  icon="checkmark-circle-outline" color={C.primary} bg={C.greenBg}  />
        <StatCard label="Urgentes"  value={urgentes}   icon="alert-circle-outline"     color={C.red}     bg={C.redBg}    />
        <StatCard label="Offline"   value={offline}    icon="cloud-offline-outline"    color={C.blue}    bg={C.blueBg}   />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Solicitacoes do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="flask-outline" msg="Nenhuma solicitacao de insumo neste turno" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.iconDot, { backgroundColor: item.urgencia === 'urgente' ? C.redBg : C.yellowBg }]}>
                <Ionicons name="flask-outline" size={16} color={item.urgencia === 'urgente' ? C.red : C.yellow} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rowTitle}>{item.lider_produtos?.nome ?? '?'}</Text>
                <Text style={s.rowSub}>{item.quantidade} {item.unidade} · {item.urgencia}</Text>
              </View>
              <StatusChip status={item.status ?? 'pendente'} size="sm" />
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Solicitar Insumo</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Section label="Produto *">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {produtos.map(p => (
                    <TouchableOpacity key={p.id} style={[s.chip, produto?.id === p.id && s.chipOn]} onPress={() => setProduto(p)}>
                      <Text style={[s.chipTx, produto?.id === p.id && s.chipTxOn]}>{p.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Section>
              <Section label={`Quantidade (${produto?.unidade ?? 'un'})`}>
                <TextInput style={s.input} value={qtd} onChangeText={setQtd} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
              </Section>
              <Section label="Urgencia">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {URGENCIA_OPTS.map(u => (
                    <TouchableOpacity key={u} style={[s.chip, urgencia === u && s.chipOn]} onPress={() => setUrgencia(u)}>
                      <Text style={[s.chipTx, urgencia === u && s.chipTxOn]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
              <Section label="Data necessaria">
                <TextInput style={s.input} value={dataNec} onChangeText={setDataNec} placeholder="DD/MM/AAAA" placeholderTextColor={C.textMuted} />
              </Section>
              <Section label="Observacao">
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={obs} onChangeText={setObs} multiline placeholder="Obs..." placeholderTextColor={C.textMuted} />
              </Section>
              <TouchableOpacity style={s.saveBtn} onPress={handleSalvar} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTx}>Enviar Solicitacao</Text>}
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