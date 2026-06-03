// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
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

const STATUS_OPTS = ['enviado','validado','divergente']
interface Produto { id: string; nome: string; unidade: string }

export default function InsumoApontamentoScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const router      = useRouter()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,  setRecords]  = useState([])
  const [produtos, setProdutos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [produto,    setProduto]   = useState(null)
  const [quantidade, setQtd]       = useState('')
  const [area,       setArea]      = useState('')
  const [status,     setStatus]    = useState('enviado')
  const [obs,        setObs]       = useState('')

  useEffect(() => { nav.setOptions({ title: 'Apontamento de Insumos' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_apontamentos_insumo')
      .select('id, quantidade, unidade, status, created_at, lider_produtos(nome)')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords((data ?? []).map(r => ({
      id: r.id,
      produto_nome: r.lider_produtos?.nome ?? '�',
      quantidade: r.quantidade,
      unidade: r.unidade,
      status: r.status ?? 'enviado',
      created_at: r.created_at,
      sync_status: 'synced',
    })))
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

  const hoje        = records.filter(r => r.created_at?.startsWith(turnoAtivo?.data ?? ''))
  const totalQtd    = records.reduce((s, r) => s + (r.quantidade ?? 0), 0)
  const divergentes = records.filter(r => r.status === 'divergente').length
  const pendentes   = queue.filter(r => r.table === 'lider_apontamentos_insumo').length

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!produto)   { Alert.alert('Aten��o', 'Selecione o produto'); return }
    if (!quantidade){ Alert.alert('Aten��o', 'Informe a quantidade'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const id = uuidv4()
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      produto_id: produto.id, quantidade: parseFloat(quantidade) || 0,
      unidade: produto.unidade, area_aplicada: parseFloat(area) || null,
      status, observacao: obs, criado_por: user.user?.id,
    }
    try {
      if (await isClearlyOffline()) throw new Error('offline')
      const { error } = await supabase.from('lider_apontamentos_insumo').insert(payload)
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_apontamentos_insumo', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ id, produto_nome: produto.nome, quantidade: parseFloat(quantidade), unidade: produto.unidade, status, created_at: new Date().toISOString(), sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Ser� sincronizado quando a conex�o voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setProduto(null); setQtd(''); setArea(''); setObs(''); setStatus('enviado')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 0 }}>
        <StatCard label="Insumos hoje"  value={hoje.length}          icon="flask-outline"         color={C.primary} bg={C.greenBg} />
        <StatCard label="Qtd. total"    value={totalQtd.toFixed(1)}  icon="cube-outline"          color={C.blue}    bg={C.blueBg}  />
        <StatCard label="Diverg�ncias"  value={divergentes}          icon="warning-outline"       color={C.red}     bg={C.redBg}   />
        <StatCard label="Offline"       value={pendentes}            icon="cloud-offline-outline" color={C.yellow}  bg={C.yellowBg}/>
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Hist�rico do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={records}
          keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="flask-outline" msg="Nenhum insumo apontado neste turno" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{item.produto_nome}</Text>
                <Text style={s.rowSub}>{item.quantidade} {item.unidade} � {fmtDate(item.created_at?.split('T')[0])}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StatusChip status={item.status} size="sm" />
                {item.sync_status === 'pending' && <StatusChip status="pending" size="sm" />}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Novo Apontamento de Insumo</Text>
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
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Section label={`Quantidade (${produto?.unidade ?? 'un'})`}>
                    <TextInput style={s.input} value={quantidade} onChangeText={setQtd} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
                <View style={{ flex: 1 }}>
                  <Section label="�rea (ha)">
                    <TextInput style={s.input} value={area} onChangeText={setArea} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </View>
              </View>
              <Section label="Status">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {STATUS_OPTS.map(st => (
                    <TouchableOpacity key={st} style={[s.chip, status === st && s.chipOn]} onPress={() => setStatus(st)}>
                      <Text style={[s.chipTx, status === st && s.chipTxOn]}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
              <Section label="Observa��o">
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
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bgMuted, marginRight: 8 },
  chipOn:      { backgroundColor: C.primary },
  chipTx:      { fontSize: 12, fontWeight: '600', color: C.textSub },
  chipTxOn:    { color: '#fff' },
  input:       { backgroundColor: C.bgMuted, borderRadius: 10, padding: 12, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  saveBtn:     { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveTx:      { color: '#fff', fontWeight: '800', fontSize: 15 },
})
