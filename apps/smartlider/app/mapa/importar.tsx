// @ts-nocheck
import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useNavigation } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

const TIPOS = [
  { key: 'acesso',          label: 'Acesso',           icon: 'navigate-outline' },
  { key: 'microplanejamento', label: 'Microplan.',     icon: 'map-outline'      },
  { key: 'outro',           label: 'Outro',            icon: 'document-outline' },
]

export default function ImportarMapaScreen() {
  const nav         = useNavigation()
  const router      = useRouter()
  const workspaceId = useLiderStore(s => s.workspaceId)

  // Form state
  const [imagem,   setImagem]   = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [nome,     setNome]     = useState('')
  const [tipo,     setTipo]     = useState<'acesso' | 'microplanejamento' | 'outro'>('acesso')
  const [descricao, setDescricao] = useState('')
  const [swLat,    setSwLat]    = useState('')
  const [swLng,    setSwLng]    = useState('')
  const [neLat,    setNeLat]    = useState('')
  const [neLng,    setNeLng]    = useState('')

  // UI state
  const [uploading,  setUploading]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [progress,   setProgress]   = useState(0)

  useEffect(() => {
    nav.setOptions({
      title: 'Importar Mapa',
      headerRight: () => (
        <TouchableOpacity
          onPress={handleImportar}
          disabled={uploading}
          style={{ paddingHorizontal: 8 }}
        >
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 15 }}>
            {uploading ? 'Enviando…' : 'Importar'}
          </Text>
        </TouchableOpacity>
      ),
    })
  }, [imagem, nome, tipo, swLat, swLng, neLat, neLng, uploading])

  // ── Pick image ──────────────────────────────────────────────────────────
  async function pickImagem() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permite acesso à galeria para selecionar o mapa.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets.length > 0) {
      setImagem(result.assets[0])
    }
  }

  // ── GPS auto-fill ────────────────────────────────────────────────────────
  async function usarGPS() {
    setGpsLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permissão GPS negada')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude: lat, longitude: lng } = loc.coords
      // 500m buffer ≈ 0.0045°
      const delta = 0.0045
      setSwLat((lat - delta).toFixed(6))
      setSwLng((lng - delta).toFixed(6))
      setNeLat((lat + delta).toFixed(6))
      setNeLng((lng + delta).toFixed(6))
    } catch (e) {
      Alert.alert('Erro GPS', String(e))
    } finally {
      setGpsLoading(false)
    }
  }

  // ── Upload & save ────────────────────────────────────────────────────────
  async function handleImportar() {
    if (!imagem)        return Alert.alert('Selecione a imagem do mapa')
    if (!nome.trim())   return Alert.alert('Informe o nome do mapa')
    if (!swLat || !swLng || !neLat || !neLng)
      return Alert.alert('Preencha as 4 coordenadas do enquadramento')

    const parsedSwLat = parseFloat(swLat)
    const parsedSwLng = parseFloat(swLng)
    const parsedNeLat = parseFloat(neLat)
    const parsedNeLng = parseFloat(neLng)

    if ([parsedSwLat, parsedSwLng, parsedNeLat, parsedNeLng].some(isNaN))
      return Alert.alert('Coordenadas inválidas', 'Use números decimais, ex: -19.921')

    setUploading(true)
    setProgress(0.1)

    try {
      // 1. Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imagem.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      setProgress(0.3)

      // 2. Convert base64 → Uint8Array (Hermes supports atob)
      const binaryStr = atob(base64)
      const bytes     = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      setProgress(0.4)

      // 3. Upload to Supabase Storage
      const ext      = imagem.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
      const filePath = `${workspaceId}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('mapas-lider')
        .upload(filePath, bytes.buffer, { contentType: mimeType, upsert: false })

      if (upErr) throw upErr
      setProgress(0.75)

      // 4. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('mapas-lider')
        .getPublicUrl(filePath)

      // 5. Insert metadata
      const { error: dbErr } = await supabase.from('lider_mapas').insert({
        workspace_id:  workspaceId,
        nome:          nome.trim(),
        tipo,
        descricao:     descricao.trim() || null,
        imagem_url:    publicUrl,
        tamanho_bytes: imagem.fileSize ?? null,
        sw_lat:        parsedSwLat,
        sw_lng:        parsedSwLng,
        ne_lat:        parsedNeLat,
        ne_lng:        parsedNeLng,
      })
      if (dbErr) throw dbErr

      setProgress(1)
      Alert.alert('Mapa importado!', `"${nome.trim()}" está disponível na lista.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Erro ao importar', e?.message ?? String(e))
    } finally {
      setUploading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ScrollView style={st.root} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled">

      {/* ── Imagem ────────────────────────────────────────────────────── */}
      <TouchableOpacity style={st.imgPicker} onPress={pickImagem} activeOpacity={0.8}>
        {imagem ? (
          <Image source={{ uri: imagem.uri }} style={st.imgPreview} resizeMode="contain" />
        ) : (
          <>
            <View style={st.imgIconWrap}>
              <Ionicons name="image-outline" size={36} color={C.primary} />
            </View>
            <Text style={st.imgHint}>Toque para selecionar a imagem do mapa</Text>
            <Text style={st.imgSub}>PNG ou JPG exportado do GeoPDF</Text>
          </>
        )}
      </TouchableOpacity>

      {imagem && (
        <TouchableOpacity onPress={pickImagem} style={st.changeBtn}>
          <Ionicons name="swap-horizontal-outline" size={16} color={C.primary} />
          <Text style={st.changeBtnTxt}>Trocar imagem</Text>
        </TouchableOpacity>
      )}

      {/* ── Nome ──────────────────────────────────────────────────────── */}
      <Text style={st.label}>Nome do mapa *</Text>
      <TextInput
        style={st.input}
        placeholder="Ex: Área Sul – Bloco 3"
        placeholderTextColor={C.textMuted}
        value={nome}
        onChangeText={setNome}
        maxLength={80}
      />

      {/* ── Tipo ──────────────────────────────────────────────────────── */}
      <Text style={st.label}>Tipo</Text>
      <View style={st.tipoRow}>
        {TIPOS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[st.tipoBtn, tipo === t.key && st.tipoBtnActive]}
            onPress={() => setTipo(t.key as any)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={t.icon as any}
              size={17}
              color={tipo === t.key ? '#fff' : C.textMuted}
            />
            <Text style={[st.tipoBtnTxt, tipo === t.key && st.tipoBtnTxtActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Descrição ─────────────────────────────────────────────────── */}
      <Text style={st.label}>Descrição (opcional)</Text>
      <TextInput
        style={[st.input, { height: 72 }]}
        placeholder="Observações sobre o mapa..."
        placeholderTextColor={C.textMuted}
        value={descricao}
        onChangeText={setDescricao}
        multiline
        maxLength={300}
      />

      {/* ── Bounding box ──────────────────────────────────────────────── */}
      <View style={st.sectionHeader}>
        <Text style={st.label}>Enquadramento (bounding box) *</Text>
        <TouchableOpacity
          style={st.gpsBtn}
          onPress={usarGPS}
          disabled={gpsLoading}
          activeOpacity={0.8}
        >
          {gpsLoading
            ? <ActivityIndicator size="small" color={C.primary} />
            : <Ionicons name="locate-outline" size={15} color={C.primary} />
          }
          <Text style={st.gpsBtnTxt}>Usar GPS</Text>
        </TouchableOpacity>
      </View>

      <Text style={st.bboxHint}>
        Coordenadas dos cantos do mapa em graus decimais (WGS84).
      </Text>

      <View style={st.coordGrid}>
        <View style={st.coordCell}>
          <Text style={st.coordLabel}>SW Latitude</Text>
          <TextInput style={st.coordInput} placeholder="-20.123456"
            placeholderTextColor={C.textMuted} keyboardType="numeric"
            value={swLat} onChangeText={setSwLat} />
        </View>
        <View style={st.coordCell}>
          <Text style={st.coordLabel}>SW Longitude</Text>
          <TextInput style={st.coordInput} placeholder="-49.123456"
            placeholderTextColor={C.textMuted} keyboardType="numeric"
            value={swLng} onChangeText={setSwLng} />
        </View>
        <View style={st.coordCell}>
          <Text style={st.coordLabel}>NE Latitude</Text>
          <TextInput style={st.coordInput} placeholder="-20.115000"
            placeholderTextColor={C.textMuted} keyboardType="numeric"
            value={neLat} onChangeText={setNeLat} />
        </View>
        <View style={st.coordCell}>
          <Text style={st.coordLabel}>NE Longitude</Text>
          <TextInput style={st.coordInput} placeholder="-49.115000"
            placeholderTextColor={C.textMuted} keyboardType="numeric"
            value={neLng} onChangeText={setNeLng} />
        </View>
      </View>

      {/* ── Upload progress ───────────────────────────────────────────── */}
      {uploading && (
        <View style={st.progressWrap}>
          <View style={[st.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
          <Text style={st.progressTxt}>
            {progress < 0.4 ? 'Preparando…' : progress < 0.75 ? 'Enviando imagem…' : 'Salvando…'}
          </Text>
        </View>
      )}

      {/* ── Botão importar ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[st.importBtn, uploading && st.importBtnDisabled]}
        onPress={handleImportar}
        disabled={uploading}
        activeOpacity={0.85}
      >
        {uploading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        }
        <Text style={st.importBtnTxt}>
          {uploading ? 'Enviando…' : 'Importar mapa'}
        </Text>
      </TouchableOpacity>

      <Text style={st.scriptNote}>
        Para mapas GeoPDF completos com georef automático, use o script{'\n'}
        scripts/geopdf_to_supabase.py no computador.
      </Text>
    </ScrollView>
  )
}

const st = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  label:         { fontSize: 13, fontWeight: '600', color: C.text, marginTop: 18, marginBottom: 6 },

  // Image picker
  imgPicker:     { backgroundColor: C.bgCard, borderRadius: 14, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', minHeight: 180, overflow: 'hidden' },
  imgPreview:    { width: '100%', height: 220 },
  imgIconWrap:   { width: 64, height: 64, borderRadius: 32, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  imgHint:       { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 4 },
  imgSub:        { fontSize: 12, color: C.textMuted },
  changeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 8 },
  changeBtnTxt:  { fontSize: 13, color: C.primary, fontWeight: '600' },

  // Inputs
  input:         { backgroundColor: C.bgCard, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 14, color: C.text },

  // Tipo
  tipoRow:       { flexDirection: 'row', gap: 8 },
  tipoBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  tipoBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  tipoBtnTxt:    { fontSize: 13, fontWeight: '600', color: C.textMuted },
  tipoBtnTxtActive: { color: '#fff' },

  // Bounding box
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 0 },
  gpsBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.greenBg },
  gpsBtnTxt:     { fontSize: 13, fontWeight: '600', color: C.primary },
  bboxHint:      { fontSize: 12, color: C.textMuted, marginBottom: 10, marginTop: 4 },
  coordGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  coordCell:     { width: '47%' },
  coordLabel:    { fontSize: 11, fontWeight: '600', color: C.textSub, marginBottom: 4 },
  coordInput:    { backgroundColor: C.bgCard, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 6, fontSize: 13, color: C.text },

  // Progress
  progressWrap:  { marginTop: 20, backgroundColor: C.bgCard, borderRadius: 10, borderWidth: 1, borderColor: C.border, height: 38, overflow: 'hidden', justifyContent: 'center' },
  progressBar:   { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.greenBg },
  progressTxt:   { textAlign: 'center', fontSize: 13, fontWeight: '600', color: C.text, zIndex: 1 },

  // Import button
  importBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  importBtnDisabled: { opacity: 0.5 },
  importBtnTxt:      { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Script note
  scriptNote:    { marginTop: 16, fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },
})
