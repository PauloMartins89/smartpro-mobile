import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

interface Colaborador { id: string; nome: string; matricula: string }
interface Epi { id: string; nome: string; ca: string }

const MOTIVOS = ['Desgaste normal', 'Perda/extravio', 'Dano/quebra', 'Novo colaborador', 'Outro']

export default function SolicitarEpiScreen() {
  const nav         = useNavigation()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const [colabs,    setColabs]    = useState<Colaborador[]>([])
  const [epis,      setEpis]      = useState<Epi[]>([])
  const [colab,     setColab]     = useState<Colaborador | null>(null)
  const [epi,       setEpi]       = useState<Epi | null>(null)
  const [motivo,    setMotivo]    = useState(MOTIVOS[0])
  const [obs,       setObs]       = useState('')
  const [foto,      setFoto]      = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Solicitar EPI' }) }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('lider_colaboradores').select('id, nome, matricula').eq('equipe_id', turnoAtivo?.equipe_id ?? '').eq('ativo', true).order('nome'),
      supabase.from('lider_epis').select('id, nome, ca').eq('workspace_id', workspaceId).eq('ativo', true).order('nome'),
    ]).then(([{ data: cs }, { data: es }]) => {
      setColabs(cs ?? [])
      setEpis(es   ?? [])
      setLoading(false)
    })
  }, [])

  async function pickFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false, mediaTypes: ImagePicker.MediaTypeOptions.Images })
    if (!result.canceled && result.assets[0]) setFoto(result.assets[0].uri)
  }

  async function handleSolicitar() {
    if (!turnoAtivo) return
    if (!colab) { Alert.alert('Atenção', 'Selecione o colaborador'); return }
    if (!epi)   { Alert.alert('Atenção', 'Selecione o EPI'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    let fotoUrl: string | null = null
    if (foto) {
      const ext  = foto.split('.').pop()
      const path = `epi/${turnoAtivo.id}/${Date.now()}.${ext}`
      const blob = await (await fetch(foto)).blob()
      const { data: up, error: upErr } = await supabase.storage.from('lider-fotos').upload(path, blob, { contentType: `image/${ext}` })
      if (!upErr && up) {
        const { data: { publicUrl } } = supabase.storage.from('lider-fotos').getPublicUrl(up.path)
        fotoUrl = publicUrl
      }
    }

    const { error } = await supabase.from('lider_solicitacoes_epi').insert({
      turno_id:      turnoAtivo.id,
      workspace_id:  workspaceId,
      colaborador_id:colab.id,
      epi_id:        epi.id,
      motivo,
      observacao:    obs,
      foto_url:      fotoUrl,
      criado_por:    user.user?.id,
      status:        'pendente',
    })

    if (error) Alert.alert('Erro', error.message)
    else {
      Alert.alert('Solicitação Enviada', `EPI para ${colab.nome} solicitado!`)
      setColab(null); setEpi(null); setFoto(null); setObs(''); setMotivo(MOTIVOS[0])
    }
    setSaving(false)
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SL>Colaborador</SL>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {colabs.map(c => (
            <TouchableOpacity key={c.id} style={[styles.chip, colab?.id === c.id && styles.chipActive]} onPress={() => setColab(c)}>
              <Text style={[styles.chipText, colab?.id === c.id && styles.chipTextActive]}>{c.nome}</Text>
              <Text style={[styles.chipSub,  colab?.id === c.id && { color: C.greenText }]}>{c.matricula}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <SL>EPI</SL>
        {epis.map(e => (
          <TouchableOpacity key={e.id} style={[styles.card, epi?.id === e.id && styles.cardActive]} onPress={() => setEpi(e)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, epi?.id === e.id && { color: C.primaryDark }]}>{e.nome}</Text>
              {!!e.ca && <Text style={styles.cardSub}>CA {e.ca}</Text>}
            </View>
            {epi?.id === e.id && <Text style={{ color: C.primary, fontWeight: '700' }}>✓</Text>}
          </TouchableOpacity>
        ))}

        <SL>Motivo</SL>
        <View style={styles.chipRow}>
          {MOTIVOS.map(m => (
            <TouchableOpacity key={m} style={[styles.motivo, motivo === m && styles.motivoActive]} onPress={() => setMotivo(m)}>
              <Text style={[styles.motivoText, motivo === m && styles.motivoTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SL>Foto do EPI Danificado (opcional)</SL>
        <TouchableOpacity style={styles.fotoBtn} onPress={pickFoto}>
          {foto
            ? <Image source={{ uri: foto }} style={styles.fotoPreview} />
            : <Text style={styles.fotoBtnText}>📷  Tirar Foto</Text>
          }
        </TouchableOpacity>

        <SL>Observação</SL>
        <TextInput style={[styles.input, { minHeight: 60 }]} value={obs} onChangeText={setObs} multiline placeholder="Detalhes adicionais..." placeholderTextColor={C.textMuted} />
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSolicitar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar Solicitação de EPI</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function SL({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{children}</Text>
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chip:           { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, backgroundColor: C.bgMuted, minWidth: 80 },
  chipActive:     { borderColor: C.primary, backgroundColor: C.greenBg },
  chipText:       { fontSize: 12, fontWeight: '700', color: C.textSub },
  chipTextActive: { color: C.primaryDark },
  chipSub:        { fontSize: 10, color: C.textMuted, marginTop: 2 },
  card:           { backgroundColor: C.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: C.border, flexDirection: 'row', alignItems: 'center' },
  cardActive:     { borderColor: C.primary, backgroundColor: C.greenBg },
  cardTitle:      { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub:        { fontSize: 11, color: C.textSub },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  motivo:         { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.bgMuted },
  motivoActive:   { borderColor: C.primary, backgroundColor: C.greenBg },
  motivoText:     { fontSize: 12, fontWeight: '600', color: C.textSub },
  motivoTextActive:{ color: C.primaryDark },
  fotoBtn:        { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgMuted, marginBottom: 20 },
  fotoBtnText:    { fontSize: 14, color: C.textSub, fontWeight: '600' },
  fotoPreview:    { width: '100%', height: 100, borderRadius: 12 },
  input:          { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.bgCard, marginBottom: 20 },
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:            { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },
})
