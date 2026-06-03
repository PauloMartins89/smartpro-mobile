// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, Image,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import useSyncStore from '../../src/store/useSyncStore'
import { isClearlyOffline } from '../../src/lib/network'
import { C, fmtDate } from '../../src/lib/theme'
import { StatCard, StatusChip, SyncBanner, Section, EmptyList } from '../../src/components/ModuleShared'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Constantes ──────────────────────────────────────────────────────────────
const TIPOS = [
  { key: 'quebra_equipamento', label: 'Quebra Equip.',  icon: 'construct-outline',      color: C.orange  },
  { key: 'acidente_pessoal',   label: 'Acidente',       icon: 'medkit-outline',         color: C.red     },
  { key: 'chuva_vento',        label: 'Chuva/Vento',   icon: 'thunderstorm-outline',   color: C.blue    },
  { key: 'qualidade',          label: 'Qualidade',      icon: 'alert-circle-outline',   color: C.yellow  },
  { key: 'seguranca',          label: 'Segurança',      icon: 'shield-outline',         color: C.red     },
  { key: 'outro',              label: 'Outro',          icon: 'ellipsis-horizontal-outline', color: C.textMuted },
]

const GRAVIDADES = [
  { key: 'baixa',   label: 'Baixa',    color: C.blue,   bg: C.blueBg   },
  { key: 'media',   label: 'Média',    color: C.yellow, bg: C.yellowBg },
  { key: 'alta',    label: 'Alta',     color: C.orange, bg: C.orangeBg },
  { key: 'critica', label: 'Crítica',  color: C.red,    bg: C.redBg    },
]

const STATUS_OCORRENCIA = {
  aberta:        { label: 'Aberta',         color: C.red,    bg: C.redBg    },
  em_tratamento: { label: 'Em tratamento',  color: C.yellow, bg: C.yellowBg },
  resolvida:     { label: 'Resolvida',      color: C.green,  bg: C.greenBg  },
}

function tipoInfo(key: string) {
  return TIPOS.find(t => t.key === key) ?? { label: key, icon: 'help-circle-outline', color: C.textMuted }
}

function gravInfo(key: string) {
  return GRAVIDADES.find(g => g.key === key) ?? GRAVIDADES[1]
}

// ── Card de ocorrência ───────────────────────────────────────────────────────
function OcorrenciaCard({ item }) {
  const ti  = tipoInfo(item.tipo)
  const gi  = gravInfo(item.gravidade)
  const st  = STATUS_OCORRENCIA[item.status] ?? STATUS_OCORRENCIA.aberta
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.tipoIcon, { backgroundColor: gi.bg }]}>
          <Ionicons name={ti.icon as any} size={18} color={ti.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.tipoLabel}>{ti.label}</Text>
          <Text style={s.cardDate}>{fmtDate(item.created_at?.slice(0, 10) ?? '')}</Text>
        </View>
        <View style={[s.gravBadge, { backgroundColor: gi.bg }]}>
          <Text style={[s.gravText, { color: gi.color }]}>{gi.label}</Text>
        </View>
      </View>
      <Text style={s.descricao} numberOfLines={2}>{item.descricao}</Text>
      <View style={s.cardFooter}>
        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
        {item.sync_status === 'pending' && (
          <View style={[s.statusBadge, { backgroundColor: C.yellowBg }]}>
            <Ionicons name="cloud-upload-outline" size={12} color={C.yellowText} />
            <Text style={[s.statusText, { color: C.yellowText, marginLeft: 3 }]}>Pendente</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Tela principal ───────────────────────────────────────────────────────────
export default function OcorrenciaScreen() {
  const nav         = useNavigation()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const addToQueue  = useSyncStore(s => s.addToQueue)
  const queue       = useSyncStore(s => s.queue)

  const [records,   setRecords]  = useState([])
  const [loading,   setLoading]  = useState(true)
  const [showForm,  setShowForm] = useState(false)
  const [saving,    setSaving]   = useState(false)

  // Campos do formulário
  const [tipo,      setTipo]      = useState('quebra_equipamento')
  const [gravidade, setGrav]      = useState('media')
  const [descricao, setDescricao] = useState('')
  const [obs,       setObs]       = useState('')
  const [fotoUri,   setFotoUri]   = useState<string | null>(null)

  useEffect(() => { nav.setOptions({ title: 'Ocorrências' }) }, [])

  // ── Carregar registros ─────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    const { data } = await supabase
      .from('lider_ocorrencias')
      .select('id, tipo, descricao, gravidade, status, foto_url, created_at')
      .eq('turno_id', turnoAtivo.id)
      .order('created_at', { ascending: false })
    // Mescla com pendentes da fila
    const queueItems = useSyncStore.getState().queue
      .filter(r => r.table === 'lider_ocorrencias' && r.payload.turno_id === turnoAtivo.id)
    const pendentes = queueItems.map(r => ({ ...r.payload, sync_status: 'pending' }))
    const syncedIds = new Set((data ?? []).map(r => r.id))
    setRecords([...(data ?? []), ...pendentes.filter(r => !syncedIds.has(r.id))])
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  // ── Selecionar foto ────────────────────────────────────────────────────────
  async function pickFoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Acesso à galeria negado.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.7, allowsEditing: true,
    })
    if (!result.canceled && result.assets.length) setFotoUri(result.assets[0].uri)
  }

  async function tirarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Acesso à câmera negado.'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
    if (!result.canceled && result.assets.length) setFotoUri(result.assets[0].uri)
  }

  // ── Salvar ────────────────────────────────────────────────────────────────
  async function handleSalvar() {
    if (!turnoAtivo) { Alert.alert('Atenção', 'Nenhum turno ativo.'); return }
    if (!descricao.trim()) { Alert.alert('Atenção', 'Informe a descrição da ocorrência.'); return }
    setSaving(true)
    try {
      // Upload foto se houver (só online)
      let foto_url: string | null = null
      if (fotoUri && !(await isClearlyOffline())) {
        const ext  = fotoUri.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${workspaceId}/ocorrencias/${uuidv4()}.${ext}`
        const resp = await fetch(fotoUri)
        const blob = await resp.blob()
        const { error: upErr } = await supabase.storage
          .from('lider-fotos').upload(path, blob, { contentType: `image/${ext}` })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('lider-fotos').getPublicUrl(path)
          foto_url = urlData.publicUrl
        }
      }

      const id      = uuidv4()
      const payload = {
        id,
        turno_id:    turnoAtivo.id,
        workspace_id: workspaceId,
        equipe_id:   turnoAtivo.equipe_id,
        tipo,
        descricao:   descricao.trim(),
        gravidade,
        foto_url,
        observacao:  obs.trim() || null,
        status:      'aberta',
        created_at:  new Date().toISOString(),
      }

      if (await isClearlyOffline()) throw new Error('offline')
      const { error } = await supabase.from('lider_ocorrencias').insert(payload)
      if (error) throw error

      setRecords(prev => [{ ...payload, sync_status: 'synced' }, ...prev])
    } catch {
      // Salva na fila offline
      const id = uuidv4()
      const payload = {
        id,
        turno_id:    turnoAtivo.id,
        workspace_id: workspaceId,
        equipe_id:   turnoAtivo.equipe_id,
        tipo,
        descricao:   descricao.trim(),
        gravidade,
        foto_url:    null,
        observacao:  obs.trim() || null,
        status:      'aberta',
        created_at:  new Date().toISOString(),
      }
      addToQueue({ id, table: 'lider_ocorrencias', action: 'insert', payload, created_at: new Date().toISOString() })
      setRecords(prev => [{ ...payload, sync_status: 'pending' }, ...prev])
    } finally {
      setSaving(false)
      setShowForm(false)
      setDescricao('')
      setObs('')
      setFotoUri(null)
      setTipo('quebra_equipamento')
      setGrav('media')
    }
  }

  // ── Estatísticas ───────────────────────────────────────────────────────────
  const total   = records.length
  const abertas = records.filter(r => r.status === 'aberta').length
  const criticas = records.filter(r => r.gravidade === 'critica').length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SyncBanner />
      <FlatList
        data={records}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        refreshing={false}
        onRefresh={carregar}
        ListHeaderComponent={
          <View>
            <View style={s.statsRow}>
              <StatCard label="Total" value={total}   icon="warning-outline"    color={C.orange} bg={C.orangeBg} />
              <StatCard label="Abertas" value={abertas} icon="alert-circle-outline" color={C.red}    bg={C.redBg}    />
              <StatCard label="Críticas" value={criticas} icon="flame-outline"   color={C.red}    bg={C.redBg}    />
            </View>
            {!turnoAtivo && (
              <View style={s.warnBox}>
                <Ionicons name="warning-outline" size={18} color={C.yellowText} />
                <Text style={s.warnText}>Nenhum turno ativo. Inicie um turno para registrar ocorrências.</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
            : <EmptyList icon="warning-outline" text="Nenhuma ocorrência neste turno" />
        }
        renderItem={({ item }) => <OcorrenciaCard item={item} />}
      />

      {/* FAB Adicionar */}
      {turnoAtivo && (
        <TouchableOpacity
          style={[s.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => setShowForm(true)}
          activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal Formulário */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modalWrap, { paddingTop: insets.top + 16 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nova Ocorrência</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Tipo */}
            <Text style={s.label}>Tipo de Ocorrência</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {TIPOS.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.chip, tipo === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setTipo(t.key)}>
                  <Ionicons name={t.icon as any} size={14} color={tipo === t.key ? '#fff' : t.color} />
                  <Text style={[s.chipText, tipo === t.key && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Gravidade */}
            <Text style={s.label}>Gravidade</Text>
            <View style={s.chipRow}>
              {GRAVIDADES.map(g => (
                <TouchableOpacity
                  key={g.key}
                  style={[s.chip, gravidade === g.key && { backgroundColor: g.color, borderColor: g.color }]}
                  onPress={() => setGrav(g.key)}>
                  <Text style={[s.chipText, gravidade === g.key && { color: '#fff' }]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Descrição */}
            <Text style={s.label}>Descrição *</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Descreva o que aconteceu..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Observação */}
            <Text style={s.label}>Observação (opcional)</Text>
            <TextInput
              style={[s.input, s.inputMulti, { height: 72 }]}
              value={obs}
              onChangeText={setObs}
              placeholder="Informações adicionais..."
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
            />

            {/* Foto */}
            <Text style={s.label}>Foto (opcional)</Text>
            <View style={s.fotoRow}>
              <TouchableOpacity style={s.fotoBtn} onPress={tirarFoto}>
                <Ionicons name="camera-outline" size={20} color={C.primary} />
                <Text style={s.fotoBtnText}>Câmera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.fotoBtn} onPress={pickFoto}>
                <Ionicons name="images-outline" size={20} color={C.primary} />
                <Text style={s.fotoBtnText}>Galeria</Text>
              </TouchableOpacity>
            </View>
            {fotoUri && (
              <View style={s.fotoPreview}>
                <Image source={{ uri: fotoUri }} style={{ width: '100%', height: 160, borderRadius: 10 }} />
                <TouchableOpacity style={s.fotoRemove} onPress={() => setFotoUri(null)}>
                  <Ionicons name="close-circle" size={24} color={C.red} />
                </TouchableOpacity>
              </View>
            )}

            {/* Botão Salvar */}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSalvar}
              disabled={saving}
              activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                   <Text style={s.saveBtnText}>Registrar Ocorrência</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  statsRow:    { flexDirection: 'row', marginBottom: 16 },
  warnBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.yellowBg, borderRadius: 12, padding: 14, marginBottom: 12, gap: 8 },
  warnText:    { flex: 1, fontSize: 13, color: C.yellowText },

  card:        { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipoIcon:    { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  tipoLabel:   { fontSize: 14, fontWeight: '700', color: C.text },
  cardDate:    { fontSize: 11, color: C.textMuted, marginTop: 2 },
  gravBadge:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  gravText:    { fontSize: 12, fontWeight: '700' },
  descricao:   { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 8 },
  cardFooter:  { flexDirection: 'row', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontWeight: '600' },

  fab:         { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },

  modalWrap:   { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: C.text },

  label:       { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 8, marginTop: 4 },
  input:       { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 15, color: C.text },
  inputMulti:  { height: 100, marginBottom: 16 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard, gap: 6, marginRight: 8, marginBottom: 4 },
  chipText:    { fontSize: 13, fontWeight: '600', color: C.text },

  fotoRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  fotoBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.primary, borderRadius: 12, padding: 14, gap: 8, backgroundColor: C.greenBg },
  fotoBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },
  fotoPreview: { position: 'relative', marginBottom: 16 },
  fotoRemove:  { position: 'absolute', top: 6, right: 6 },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 14, padding: 16, gap: 10, marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
