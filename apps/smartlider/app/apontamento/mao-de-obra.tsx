// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Modal, Image, Vibration,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import useSyncStore from '../../src/store/useSyncStore'
import { isClearlyOffline } from '../../src/lib/network'
import useLookupCache from '../../src/store/useLookupCache'
import { C } from '../../src/lib/theme'
import { StatCard, SyncBanner, EmptyList } from '../../src/components/ModuleShared'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

const MOTIVOS = [
  { key: 'falta_injustificada', label: 'Falta injustificada', sub: 'Sem justificativa',       icon: 'person-remove-outline',      color: '#EF4444' },
  { key: 'atestado_medico',     label: 'Atestado médico',     sub: 'Problema de saúde',        icon: 'medkit-outline',             color: '#3B82F6' },
  { key: 'compromisso_pessoal', label: 'Compromisso pessoal', sub: 'Assuntos particulares',    icon: 'people-outline',             color: '#8B5CF6' },
  { key: 'transporte',          label: 'Transporte',          sub: 'Problemas de transporte',  icon: 'bus-outline',                color: '#F59E0B' },
  { key: 'atraso',              label: 'Atraso não justif.',  sub: 'Chegada fora do horário',  icon: 'time-outline',               color: '#F59E0B' },
  { key: 'outro',               label: 'Outro',               sub: 'Outros motivos',           icon: 'ellipsis-horizontal',        color: '#6B7280' },
]

export default function MaoDeObraScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [colaboradores, setColabs]  = useState([])
  const [records,       setRecords] = useState([])
  const [loading,       setLoading] = useState(true)
  const [saving,        setSaving]  = useState(false)
  const [horaIni,       setHoraIni] = useState('07:00')
  const [horaFim,       setHoraFim] = useState('17:00')

  // ausentes: { [colaborador_id]: motivo_string }  — todos presentes por padrão
  const [ausentes, setAusentes] = useState({})

  // Modal registrar falta (histórico)
  const [showAddModal,    setShowAddModal]    = useState(false)
  const [addColab,        setAddColab]        = useState(null)
  const [addMotivoKey,    setAddMotivoKey]    = useState('')
  const [addObs,          setAddObs]          = useState('')
  const [addAnexoUri,     setAddAnexoUri]     = useState(null)
  const [addErrors,       setAddErrors]       = useState({})
  const [addSaving,       setAddSaving]       = useState(false)
  const [showColabPicker, setShowColabPicker] = useState(false)
  const [colabSearch,     setColabSearch]     = useState('')

  useEffect(() => { nav.setOptions({ title: 'Mão de Obra' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_mao_obra')
      .select('id, colaborador_id, colaborador_nome, cargo, presente, horas_trabalhadas, observacao')
      .eq('turno_id', turnoAtivo.id)
      .order('colaborador_nome')
    // Mescla com pendentes da fila (visíveis mesmo offline)
    const queueItems = useSyncStore.getState().queue
      .filter(r => r.table === 'lider_mao_obra' && r.payload.turno_id === turnoAtivo.id)
    const pendentes = queueItems.map(r => ({ ...r.payload, sync_status: 'pending' }))
    const syncedIds = new Set((data ?? []).map(r => r.id))
    setRecords([...(data ?? []), ...pendentes.filter(r => !syncedIds.has(r.id))])
    setLoading(false)
  }, [turnoAtivo?.id])

  const lookupCache = useLookupCache()

  useEffect(() => {
    const key = `colaboradores:${turnoAtivo?.equipe_id}`
    const cached = lookupCache.get(key); if (cached.length) setColabs(cached)
    supabase.from('lider_colaboradores').select('id, nome, cargo')
      .eq('equipe_id', turnoAtivo?.equipe_id ?? '')
      .eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) { setColabs(data); lookupCache.set(key, data) } })
      .catch(() => {})
    carregar()
  }, [carregar])

  // Agrupa colaboradores por cargo
  const grupos = colaboradores.reduce((acc, c) => {
    const key = c.cargo ?? 'Outros'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const nAusentes      = Object.keys(ausentes).length
  const totalPresentes = colaboradores.length - nAusentes
  const pendentes      = queue.filter(r => r.table === 'lider_mao_obra').length

  function toggleAusente(c) {
    setAusentes(prev => {
      const next = { ...prev }
      if (next[c.id] !== undefined) { delete next[c.id] }
      else                          { next[c.id] = '' }
      return next
    })
  }

  function setMotivo(colaborador_id, motivo) {
    setAusentes(prev => ({ ...prev, [colaborador_id]: motivo }))
  }

  function calcHoras(ini, fim) {
    const [hi, mi] = ini.split(':').map(Number)
    const [hf, mf] = fim.split(':').map(Number)
    return Math.max(0, ((hf * 60 + mf) - (hi * 60 + mi)) / 60)
  }

  // ── Salvar em lote ───────────────────────────────────────────
  async function handleApontar() {
    if (!turnoAtivo) return
    if (colaboradores.length === 0) { Alert.alert('Atenção', 'Nenhum colaborador nesta equipe'); return }
    setSaving(true)
    const horas    = calcHoras(horaIni, horaFim)
    const payloads = colaboradores.map(c => {
      const ausente = ausentes[c.id] !== undefined
      const id      = uuidv4()
      return {
        id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
        colaborador_id: c.id, colaborador_nome: c.nome, cargo: c.cargo,
        presente:          !ausente,
        hora_entrada:      ausente ? null : horaIni,
        hora_saida:        ausente ? null : horaFim,
        horas_trabalhadas: ausente ? 0 : horas,
        observacao:        ausente ? (ausentes[c.id] || null) : null,
      }
    })
    try {
      if (await isClearlyOffline()) throw new Error('offline')
      const { error } = await supabase.from('lider_mao_obra').insert(payloads)
      if (error) throw error
      await carregar()
    } catch {
      payloads.forEach(payload =>
        addToQueue({ id: payload.id, table: 'lider_mao_obra', action: 'insert', payload, created_at: new Date().toISOString() })
      )
      setRecords(payloads.map(p => ({ ...p, sync_status: 'pending' })))
      Alert.alert('Salvo offline', `${payloads.length} registros serão sincronizados quando a conexão voltar.`)
    } finally {
      setSaving(false)
    }
  }

  // ── Registrar falta individual (histórico) ───────────────────
  async function handleAddIndividual() {
    const errs = {}
    if (!addColab)     errs.colab  = 'Selecione o colaborador ausente'
    if (!addMotivoKey) errs.motivo = 'Selecione o motivo da falta'
    if (addMotivoKey === 'outro' && !addObs.trim()) errs.obs = 'Descreva o motivo ao selecionar "Outro"'
    if (Object.keys(errs).length) {
      setAddErrors(errs)
      Vibration.vibrate([0, 80, 60, 80])
      return
    }
    setAddErrors({})
    setAddSaving(true)
    const id          = uuidv4()
    const motivoLabel = MOTIVOS.find(m => m.key === addMotivoKey)?.label ?? addMotivoKey
    const observacao  = addMotivoKey === 'outro'
      ? addObs.trim()
      : [motivoLabel, addObs.trim()].filter(Boolean).join(' — ')
    const payload = {
      id, turno_id: turnoAtivo.id, workspace_id: workspaceId,
      colaborador_id: addColab.id, colaborador_nome: addColab.nome, cargo: addColab.cargo,
      presente: false, hora_entrada: null, hora_saida: null, horas_trabalhadas: 0,
      observacao: observacao || null,
    }
    try {
      if (await isClearlyOffline()) throw new Error('offline')
      const { error } = await supabase.from('lider_mao_obra').insert(payload)
      if (error) throw error
      await carregar()
    } catch {
      addToQueue({ id, table: 'lider_mao_obra', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ ...payload, sync_status: 'pending' }, ...prev])
      Alert.alert('Salvo offline', 'Será sincronizado quando a conexão voltar.')
    } finally {
      Vibration.vibrate(50)
      setAddSaving(false)
      setShowAddModal(false)
      setAddColab(null); setAddMotivoKey(''); setAddObs(''); setAddAnexoUri(null)
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return <ActivityIndicator color={C.primary} style={{ marginTop: 80 }} />

  const presentes  = records.filter(r => r.presente).length
  const ausencias  = records.filter(r => !r.presente).length
  const horasTotal = records.reduce((s, r) => s + (r.horas_trabalhadas ?? 0), 0)

  // ── Histórico (após salvar) ──────────────────────────────────
  if (records.length > 0) return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <StatCard label="Presentes"   value={presentes}                 icon="people-outline"        color={C.primary} bg={C.greenBg}  />
        <StatCard label="Ausências"   value={ausencias}                 icon="person-remove-outline" color={C.red}     bg={C.redBg}    />
        <StatCard label="Horas total" value={horasTotal.toFixed(1)+'h'} icon="time-outline"          color={C.blue}    bg={C.blueBg}   />
        <StatCard label="Offline"     value={pendentes}                 icon="cloud-offline-outline" color={C.yellow}  bg={C.yellowBg} />
      </ScrollView>
      <FlatList data={records} keyExtractor={r => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={s.actionRow}>
            <Text style={s.sectionTitle}>Equipe apontada</Text>
            <TouchableOpacity style={s.newBtn} onPress={() => { setAddColab(null); setAddMotivoKey(''); setAddObs(''); setAddAnexoUri(null); setAddErrors({}); setShowAddModal(true) }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.newBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={<EmptyList icon="people-outline" msg="Nenhum colaborador apontado" />}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={[s.iconDot, { backgroundColor: item.presente ? C.greenBg : C.redBg }]}>
              <Ionicons name={item.presente ? 'person-outline' : 'person-remove-outline'} size={16} color={item.presente ? C.green : C.red} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.rowTitle}>{item.colaborador_nome}</Text>
              <Text style={s.rowSub}>{item.cargo ?? '—'} · {item.horas_trabalhadas?.toFixed(1) ?? '0'}h</Text>
              {item.observacao ? <Text style={[s.rowSub, { color: C.red }]}>{item.observacao}</Text> : null}
            </View>
            <View style={[s.badge, { backgroundColor: item.presente ? C.greenBg : C.redBg }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: item.presente ? C.green : C.red }}>
                {item.presente ? 'Presente' : 'Ausente'}
              </Text>
            </View>
          </View>
        )}
      />

      {/* ── Modal: Registrar Falta ── */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={[s.modal, { maxHeight: '96%' }]}>

            {/* Header */}
            <View style={s.modalHdr}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Registrar Falta</Text>
                <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
                  Registre somente colaboradores ausentes no dia.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>

              {/* Banner informativo */}
              <View style={s.infoBanner}>
                <Ionicons name="calendar-outline" size={22} color={C.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.infoBannerTitle}>Aponte somente as faltas.</Text>
                  <Text style={s.infoBannerTx}>
                    Se nada for registrado, todos serão considerados presentes.
                  </Text>
                </View>
              </View>

              {/* ── 1. Colaborador ── */}
              <View style={s.section}>
                <View style={s.stepRow}>
                  <View style={s.stepBadge}><Text style={s.stepNum}>1</Text></View>
                  <Text style={s.stepLabel}>Colaborador <Text style={{ color: C.red }}>*</Text></Text>
                </View>
                <TouchableOpacity
                  style={[s.pickerInput, addErrors.colab && s.inputError]}
                  onPress={() => { setColabSearch(''); setShowColabPicker(true) }}>
                  <Ionicons name="person-outline" size={18} color={addColab ? C.text : C.textMuted} />
                  <Text style={[s.pickerTx, !addColab && { color: C.textMuted }]} numberOfLines={1}>
                    {addColab ? addColab.nome : 'Buscar colaborador...'}
                  </Text>
                  {addColab
                    ? <TouchableOpacity onPress={() => setAddColab(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color={C.textMuted} />
                      </TouchableOpacity>
                    : <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  }
                </TouchableOpacity>
                {addColab && (
                  <View style={s.colabSelectedCard}>
                    <View style={s.colabAva}>
                      <Text style={s.colabAvaLetter}>{addColab.nome.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.colabSelectedNome}>{addColab.nome}</Text>
                      <Text style={s.colabSelectedCargo}>{addColab.cargo ?? 'Sem cargo'}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: C.redBg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.red }}>Ausente</Text>
                    </View>
                  </View>
                )}
                {addErrors.colab ? <Text style={s.errorTx}>{addErrors.colab}</Text> : null}
              </View>

              {/* ── 2. Motivo ── */}
              <View style={s.section}>
                <View style={s.stepRow}>
                  <View style={s.stepBadge}><Text style={s.stepNum}>2</Text></View>
                  <Text style={s.stepLabel}>Motivo da falta <Text style={{ color: C.red }}>*</Text></Text>
                </View>
                <View style={s.motivosGrid}>
                  {MOTIVOS.map(m => {
                    const sel = addMotivoKey === m.key
                    return (
                      <TouchableOpacity key={m.key}
                        style={[s.motivoCard, sel && { borderColor: m.color, backgroundColor: m.color + '12' }]}
                        onPress={() => setAddMotivoKey(m.key)}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                          <View style={[s.motivoIcon, { backgroundColor: m.color + '22' }]}>
                            <Ionicons name={m.icon} size={15} color={m.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.motivoLabel, sel && { color: m.color }]} numberOfLines={1}>{m.label}</Text>
                            <Text style={s.motivoSub} numberOfLines={1}>{m.sub}</Text>
                          </View>
                          {sel && <Ionicons name="checkmark-circle" size={17} color={m.color} />}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {addErrors.motivo ? <Text style={s.errorTx}>{addErrors.motivo}</Text> : null}
              </View>

              {/* ── 3. Evidência ── */}
              <View style={s.section}>
                <View style={s.stepRow}>
                  <View style={[s.stepBadge, { backgroundColor: C.bgMuted }]}>
                    <Text style={[s.stepNum, { color: C.textSub }]}>3</Text>
                  </View>
                  <Text style={s.stepLabel}>
                    Evidência{' '}
                    <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '400' }}>(opcional)</Text>
                  </Text>
                </View>
                {addAnexoUri ? (
                  <View style={s.anexoPreview}>
                    <Image source={{ uri: addAnexoUri }} style={s.anexoImg} resizeMode="cover" />
                    <TouchableOpacity style={s.anexoRemove} onPress={() => setAddAnexoUri(null)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.evidenciaBox}>
                    <Ionicons name="cloud-upload-outline" size={28} color={C.primary} />
                    <Text style={s.evidenciaTitulo}>Registre uma foto ou anexe um atestado</Text>
                    <Text style={s.evidenciaHint}>
                      Use este campo para anexar atestado, foto ou justificativa.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
                      <TouchableOpacity style={s.evidenciaBtn} onPress={async () => {
                        const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
                        if (!r.canceled) setAddAnexoUri(r.assets[0].uri)
                      }}>
                        <Ionicons name="camera-outline" size={17} color={C.text} />
                        <Text style={s.evidenciaBtnTx}>Tirar foto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.evidenciaBtn} onPress={async () => {
                        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
                        if (!r.canceled) setAddAnexoUri(r.assets[0].uri)
                      }}>
                        <Ionicons name="document-outline" size={17} color={C.text} />
                        <Text style={s.evidenciaBtnTx}>Selecionar arquivo</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 8, textAlign: 'center' }}>
                      Formatos aceitos: JPG, PNG, PDF (máx. 10MB)
                    </Text>
                  </View>
                )}
              </View>

              {/* ── 4. Observações ── */}
              <View style={s.section}>
                <View style={s.stepRow}>
                  <View style={[s.stepBadge, { backgroundColor: C.bgMuted }]}>
                    <Text style={[s.stepNum, { color: C.textSub }]}>4</Text>
                  </View>
                  <Text style={s.stepLabel}>
                    Observações{' '}
                    <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '400' }}>(opcional)</Text>
                  </Text>
                </View>
                <TextInput
                  style={[s.obsInput, addErrors.obs && s.inputError]}
                  value={addObs}
                  onChangeText={setAddObs}
                  placeholder={addMotivoKey === 'outro'
                    ? 'Descreva o motivo da ausência... *'
                    : 'Adicione informações adicionais...'}
                  placeholderTextColor={C.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={{ fontSize: 10, color: C.textMuted, textAlign: 'right', marginTop: 4 }}>
                  {addObs.length}/300
                </Text>
                {addErrors.obs ? <Text style={s.errorTx}>{addErrors.obs}</Text> : null}
              </View>

              {/* Ações */}
              <TouchableOpacity style={s.saveBtnFalta} onPress={handleAddIndividual} disabled={addSaving}>
                {addSaving
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={s.saveTx}>Salvar Falta</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={s.cancelTx}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Picker de colaborador ── */}
      <Modal visible={showColabPicker} animationType="slide" transparent>
        <View style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={[s.modal, { maxHeight: '80%' }]}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Selecionar Colaborador</Text>
              <TouchableOpacity onPress={() => setShowColabPicker(false)} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <View style={s.searchBox}>
                <Ionicons name="search-outline" size={16} color={C.textMuted} />
                <TextInput
                  style={s.searchInput}
                  value={colabSearch}
                  onChangeText={setColabSearch}
                  placeholder="Buscar por nome ou cargo..."
                  placeholderTextColor={C.textMuted}
                  autoFocus
                />
                {colabSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setColabSearch('')}>
                    <Ionicons name="close-circle" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {colaboradores
                .filter(c =>
                  c.nome.toLowerCase().includes(colabSearch.toLowerCase()) ||
                  (c.cargo ?? '').toLowerCase().includes(colabSearch.toLowerCase())
                )
                .map(c => {
                  const sel = addColab?.id === c.id
                  return (
                    <TouchableOpacity key={c.id}
                      style={[s.pickerColabRow, sel && s.pickerColabRowSel]}
                      onPress={() => { setAddColab(c); setShowColabPicker(false) }}>
                      <View style={[s.colabAva, sel && { backgroundColor: C.primary }]}>
                        <Text style={[s.colabAvaLetter, sel && { color: '#fff' }]}>
                          {c.nome.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.colabSelectedNome, sel && { color: C.primary }]}>{c.nome}</Text>
                        <Text style={s.colabSelectedCargo}>{c.cargo ?? 'Sem cargo'}</Text>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                    </TouchableOpacity>
                  )
                })
              }
              {colaboradores.filter(c =>
                c.nome.toLowerCase().includes(colabSearch.toLowerCase()) ||
                (c.cargo ?? '').toLowerCase().includes(colabSearch.toLowerCase())
              ).length === 0 && (
                <EmptyList icon="search-outline" msg="Nenhum colaborador encontrado" />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )

  // ── Tela de apontamento (antes de salvar) ────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Horário global */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Horário do Turno</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Hora Entrada</Text>
              <TextInput style={s.input} value={horaIni} onChangeText={setHoraIni}
                placeholder="07:00" placeholderTextColor={C.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Hora Saída</Text>
              <TextInput style={s.input} value={horaFim} onChangeText={setHoraFim}
                placeholder="17:00" placeholderTextColor={C.textMuted} />
            </View>
          </View>
        </View>

        {/* Card por grupo de cargo — toca para marcar falta */}
        {Object.entries(grupos).map(([cargo, colabs]) => {
          const nAusentesGrupo = colabs.filter(c => ausentes[c.id] !== undefined).length
          const nPresGrupo     = colabs.length - nAusentesGrupo
          return (
            <View key={cargo} style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View>
                  <Text style={s.cardTitle}>{cargo}</Text>
                  <Text style={s.cardSub}>{colabs.length} na equipe</Text>
                </View>
                <View style={s.counterBox}>
                  <Text style={s.counterLabel}>Presentes</Text>
                  <Text style={[s.counterNum, nPresGrupo < colabs.length && { color: C.red }]}>
                    {nPresGrupo}
                  </Text>
                </View>
              </View>

              {/* Lista de colaboradores — toca para alternar falta */}
              {colabs.map(c => {
                const ausente = ausentes[c.id] !== undefined
                return (
                  <View key={c.id}>
                    <TouchableOpacity
                      style={[s.colaboradorRow, ausente && s.colaboradorRowAusente]}
                      onPress={() => toggleAusente(c)}>
                      <View style={[s.presIcon, { backgroundColor: ausente ? C.redBg : C.greenBg }]}>
                        <Ionicons
                          name={ausente ? 'person-remove-outline' : 'person-outline'}
                          size={16} color={ausente ? C.red : C.green} />
                      </View>
                      <Text style={[s.colabNomeInline, ausente && { color: C.red, textDecorationLine: 'line-through' }]}>
                        {c.nome}
                      </Text>
                      <View style={[s.statusPill, { backgroundColor: ausente ? C.redBg : C.greenBg }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: ausente ? C.red : C.green }}>
                          {ausente ? 'FALTOU' : 'PRESENTE'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {/* Motivo inline quando ausente */}
                    {ausente && (
                      <TextInput
                        style={s.motivoInput}
                        value={ausentes[c.id]}
                        onChangeText={v => setMotivo(c.id, v)}
                        placeholder="Motivo (ex: atestado médico)..."
                        placeholderTextColor={C.textMuted}
                      />
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}

        {colaboradores.length === 0 && (
          <EmptyList icon="people-outline" msg="Nenhum colaborador cadastrado nesta equipe" />
        )}

        {/* Botão apontar em lote */}
        {colaboradores.length > 0 && (
          <TouchableOpacity style={s.saveBtn} onPress={handleApontar} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={s.saveTx}>
                  {'Apontar ' + totalPresentes + ' Presente' + (totalPresentes !== 1 ? 's' : '') +
                    (nAusentes > 0 ? '  ·  ' + nAusentes + ' Falta' + (nAusentes > 1 ? 's' : '') : '')}
                </Text>
              )
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  sectionTitle:        { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 },
  actionRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  newBtn:              { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText:          { color: '#fff', fontWeight: '700', fontSize: 13 },
  card:                { backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardTitle:           { fontSize: 15, fontWeight: '800', color: C.text },
  cardSub:             { fontSize: 12, color: C.textSub, marginTop: 2 },
  label:               { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:               { backgroundColor: C.bgMuted, borderRadius: 10, padding: 12, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  counterBox:          { alignItems: 'flex-end' },
  counterLabel:        { fontSize: 10, color: C.textSub, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  counterNum:          { fontSize: 32, fontWeight: '900', color: C.primary, lineHeight: 38 },
  colaboradorRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  colaboradorRowAusente: { opacity: 0.85 },
  presIcon:            { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  colabNomeInline:     { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  statusPill:          { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  motivoInput:         { backgroundColor: C.redBg, borderRadius: 8, padding: 10, fontSize: 13, color: C.text, marginTop: 4, marginBottom: 4, marginLeft: 42, borderWidth: 1, borderColor: '#FECACA' },
  saveBtn:             { backgroundColor: C.primary, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveTx:              { color: '#fff', fontWeight: '800', fontSize: 15 },
  row:                 { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rowTitle:            { fontSize: 14, fontWeight: '700', color: C.text },
  rowSub:              { fontSize: 12, color: C.textSub, marginTop: 2 },
  badge:               { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  iconDot:             { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  overlay:             { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal:               { backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHdr:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:          { fontSize: 15, fontWeight: '800', color: C.text },
  colabRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgMuted, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  colabRowOn:          { backgroundColor: C.primary, borderColor: C.primary },
  colabNome:           { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },

  // ── Estilos do modal "Registrar Falta" ──────────────────────
  closeBtn:            { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgMuted, justifyContent: 'center', alignItems: 'center' },
  infoBanner:          { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.greenBg, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: C.primary + '30' },
  infoBannerTitle:     { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 },
  infoBannerTx:        { fontSize: 12, color: C.textSub, lineHeight: 17 },
  section:             { marginBottom: 22 },
  stepRow:             { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge:           { width: 26, height: 26, borderRadius: 13, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  stepNum:             { fontSize: 12, fontWeight: '800', color: '#fff' },
  stepLabel:           { fontSize: 14, fontWeight: '700', color: C.text },
  pickerInput:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgMuted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: C.border },
  pickerTx:            { flex: 1, fontSize: 14, fontWeight: '500', color: C.text },
  inputError:          { borderColor: C.red, backgroundColor: C.redBg },
  errorTx:             { fontSize: 11, color: C.red, marginTop: 5, fontWeight: '600' },
  colabSelectedCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.border },
  colabAva:            { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary + '20', justifyContent: 'center', alignItems: 'center' },
  colabAvaLetter:      { fontSize: 16, fontWeight: '800', color: C.primary },
  colabSelectedNome:   { fontSize: 14, fontWeight: '700', color: C.text },
  colabSelectedCargo:  { fontSize: 12, color: C.textSub, marginTop: 1 },
  motivosGrid:         { gap: 8 },
  motivoCard:          { backgroundColor: C.bgCard, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: C.border },
  motivoIcon:          { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  motivoLabel:         { fontSize: 13, fontWeight: '700', color: C.text },
  motivoSub:           { fontSize: 11, color: C.textSub, marginTop: 1 },
  evidenciaBox:        { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, borderRadius: 14, padding: 20, alignItems: 'center', backgroundColor: C.bgMuted },
  evidenciaTitulo:     { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 10, textAlign: 'center' },
  evidenciaHint:       { fontSize: 11, color: C.textSub, marginTop: 4, textAlign: 'center', lineHeight: 16 },
  evidenciaBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.bgCard, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  evidenciaBtnTx:      { fontSize: 13, fontWeight: '600', color: C.text },
  anexoPreview:        { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  anexoImg:            { width: '100%', height: 160, borderRadius: 12 },
  anexoRemove:         { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  obsInput:            { backgroundColor: C.bgMuted, borderRadius: 12, padding: 14, fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, minHeight: 90 },
  saveBtnFalta:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, padding: 17, marginTop: 4 },
  cancelBtn:           { alignItems: 'center', padding: 14, marginTop: 8 },
  cancelTx:            { fontSize: 14, fontWeight: '600', color: C.textSub },
  searchBox:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgMuted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  searchInput:         { flex: 1, fontSize: 14, color: C.text },
  pickerColabRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  pickerColabRowSel:   { borderColor: C.primary, backgroundColor: C.greenBg },
  toggleBtn:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border },
  toggleBtnOn:         { backgroundColor: C.red, borderColor: C.red },
})