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

const STATUS_OPTS = ['aprovado','reprovado','pendente']
const TIPO_OPTS   = ['liquido','solido']
const PRODS_SOLID = ['Adubo','Calcario','Graos','Fertilizante','Outro']

export default function AfericaoScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,     setRecords]     = useState([])
  const [implementos, setImplementos] = useState([])
  const [maquinas,    setMaquinas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [maq,      setMaq]      = useState(null)
  const [impl,     setImpl]     = useState(null)
  const [tipoAf,   setTipoAf]   = useState('liquido')
  const [prodApl,  setProdApl]  = useState('Adubo')
  const [doseKg,   setDoseKg]   = useState('')
  const [vazao,    setVazao]    = useState('')
  const [veloc,    setVeloc]    = useState('')
  const [largura,  setLargura]  = useState('')
  const [status,   setStatus]   = useState('pendente')
  const [obs,      setObs]      = useState('')

  useEffect(() => { nav.setOptions({ title: 'Afericao de Maquinas' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_afericoes')
      .select('id, maquina_nome, implemento_nome, tipo_afericao, produto_aplicado, vazao_medida_lmin, volume_calda_lha, status, created_at, lider_implementos(nome), lider_maquinas(nome)')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [turnoAtivo?.id])

  const lookupCache = useLookupCache()

  useEffect(() => {
    const kImpl = `implementos:${workspaceId}`
    const kMaq  = `maquinas:${workspaceId}`
    const ci = lookupCache.get(kImpl); if (ci.length) setImplementos(ci)
    const cm = lookupCache.get(kMaq);  if (cm.length) setMaquinas(cm)
    supabase.from('lider_implementos').select('id, nome, largura_m')
      .eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setImplementos(data); lookupCache.set(kImpl, data) } })
      .catch(() => {})
    supabase.from('lider_maquinas').select('id, nome, codigo, tipo')
      .eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setMaquinas(data); lookupCache.set(kMaq, data) } })
      .catch(() => {})
    carregar()
  }, [carregar])

  const aprovados   = records.filter(r => r.status === 'aprovado').length
  const reprovados  = records.filter(r => r.status === 'reprovado').length
  const volMedio    = records.filter(r => r.tipo_afericao !== 'solido' && r.volume_calda_lha).length
    ? records.filter(r => r.tipo_afericao !== 'solido').reduce((s, r) => s + (r.volume_calda_lha ?? 0), 0) / records.filter(r => r.tipo_afericao !== 'solido' && r.volume_calda_lha).length
    : 0
  const pendentes   = queue.filter(r => r.table === 'lider_afericoes').length

  function calcVolume(v, vel, larg) {
    const vN = parseFloat(v) || 0
    const velN = parseFloat(vel) || 0
    const largN = parseFloat(larg) || 0
    if (!velN || !largN) return 0
    return (vN / ((velN / 3.6) * largN)) * 1000
  }

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!maq) { Alert.alert('Atencao', 'Selecione a maquina'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const volume_calda_lha = tipoAf === 'liquido' ? calcVolume(vazao, veloc, largura) : null
    const id = uuidv4()
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      maquina_id: maq.id, maquina_nome: maq.nome,
      implemento_id: impl?.id ?? null, implemento_nome: impl?.nome ?? null,
      tipo_afericao: tipoAf,
      produto_aplicado: tipoAf === 'solido' ? prodApl : null,
      dose_kg_ha: tipoAf === 'solido' ? (parseFloat(doseKg) || null) : null,
      vazao_medida_lmin: tipoAf === 'liquido' ? (parseFloat(vazao) || null) : null,
      velocidade_kmh: tipoAf === 'liquido' ? (parseFloat(veloc) || null) : null,
      largura_m: tipoAf === 'liquido' ? (parseFloat(largura) || null) : null,
      volume_calda_lha: tipoAf === 'liquido' ? Math.round(volume_calda_lha) : null,
      status, observacao: obs || null,
    }
    try {
      const { error } = await supabase.from('lider_afericoes').insert(payload)
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_afericoes', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ id, maquina_nome: maq.nome, implemento_nome: impl?.nome, tipo_afericao: tipoAf, lider_maquinas: { nome: maq.nome }, lider_implementos: impl ? { nome: impl.nome } : null, vazao_medida_lmin: parseFloat(vazao), volume_calda_lha: tipoAf === 'liquido' ? Math.round(calcVolume(vazao, veloc, largura)) : null, status, created_at: new Date().toISOString(), sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Sera sincronizado quando a conexao voltar.')
    } finally {
      setSaving(false); setShowForm(false)
      setMaq(null); setImpl(null); setVazao(''); setVeloc(''); setLargura(''); setObs(''); setStatus('pendente'); setDoseKg(''); setTipoAf('liquido')
    }
  }

  const volPreview = tipoAf === 'liquido' ? calcVolume(vazao, veloc, largura) : 0

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Aprovadas"   value={aprovados}              icon="checkmark-circle-outline" color={C.primary} bg={C.greenBg}  />
        <StatCard label="Reprovadas"  value={reprovados}             icon="close-circle-outline"     color={C.red}     bg={C.redBg}    />
        <StatCard label="Vol. medio"  value={volMedio.toFixed(0)+'L/ha'} icon="beaker-outline"       color={C.blue}    bg={C.blueBg}   />
        <StatCard label="Offline"     value={pendentes}              icon="cloud-offline-outline"    color={C.yellow}  bg={C.yellowBg} />
      </ScrollView>

      <View style={s.actionRow}>
        <Text style={s.sectionTitle}>Afericoes do turno</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={records} keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<EmptyList icon="beaker-outline" msg="Nenhuma afericao registrada neste turno" />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={[s.iconDot, { backgroundColor: item.status === 'aprovado' ? C.greenBg : item.status === 'reprovado' ? C.redBg : C.yellowBg }]}>
                <Ionicons name="beaker-outline" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rowTitle}>{item.maquina_nome ?? item.lider_maquinas?.nome ?? '?'}</Text>
                <Text style={s.rowSub}>
                  {item.tipo_afericao === 'solido'
                    ? (item.produto_aplicado ?? 'Solido')
                    : ((item.volume_calda_lha ?? 0) + ' L/ha · ' + (item.vazao_medida_lmin ?? 0) + ' L/min')
                  }
                </Text>
              </View>
              <StatusChip status={item.status ?? 'pendente'} size="sm" />
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Nova Afericao</Text>
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
              <Section label="Tipo de Afericao">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {TIPO_OPTS.map(t => (
                    <TouchableOpacity key={t} style={[s.chip, tipoAf === t && s.chipOn]} onPress={() => setTipoAf(t)}>
                      <Text style={[s.chipTx, tipoAf === t && s.chipTxOn]}>{t === 'liquido' ? 'Liquido (Calda)' : 'Solido (Granulado)'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
              <Section label="Implemento (opcional)">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity style={[s.chip, !impl && s.chipOn]} onPress={() => setImpl(null)}>
                    <Text style={[s.chipTx, !impl && s.chipTxOn]}>Nenhum</Text>
                  </TouchableOpacity>
                  {implementos.map(i => (
                    <TouchableOpacity key={i.id} style={[s.chip, impl?.id === i.id && s.chipOn]} onPress={() => setImpl(i)}>
                      <Text style={[s.chipTx, impl?.id === i.id && s.chipTxOn]}>{i.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Section>
              {tipoAf === 'liquido' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Section label="Vazao (L/min)">
                        <TextInput style={s.input} value={vazao} onChangeText={setVazao} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                      </Section>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Section label="Velocidade (km/h)">
                        <TextInput style={s.input} value={veloc} onChangeText={setVeloc} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                      </Section>
                    </View>
                  </View>
                  <Section label="Largura de trabalho (m)">
                    <TextInput style={s.input} value={largura} onChangeText={setLargura} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                  {(parseFloat(vazao) > 0 && parseFloat(veloc) > 0 && parseFloat(largura) > 0) && (
                    <View style={{ backgroundColor: C.greenBg, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: C.textSub }}>Volume calculado</Text>
                      <Text style={{ fontSize: 24, fontWeight: '800', color: C.primary }}>{volPreview.toFixed(0)} L/ha</Text>
                    </View>
                  )}
                </>
              )}
              {tipoAf === 'solido' && (
                <>
                  <Section label="Produto aplicado">
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {PRODS_SOLID.map(p => (
                        <TouchableOpacity key={p} style={[s.chip, prodApl === p && s.chipOn]} onPress={() => setProdApl(p)}>
                          <Text style={[s.chipTx, prodApl === p && s.chipTxOn]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Section>
                  <Section label="Dose (kg/ha)">
                    <TextInput style={s.input} value={doseKg} onChangeText={setDoseKg} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
                  </Section>
                </>
              )}
              <Section label="Status">
                <View style={{ flexDirection: 'row', gap: 8 }}>
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
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTx}>Salvar Afericao</Text>}
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