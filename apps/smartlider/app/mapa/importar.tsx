// @ts-nocheck
import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useNavigation } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

export default function ImportarMapaScreen() {
  const nav         = useNavigation()
  const router      = useRouter()
  const workspaceId = useLiderStore(s => s.workspaceId)

  const [arquivo,   setArquivo]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)

  // Abre a galeria de imagens do Android
  async function selecionarArquivo() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos de acesso à galeria para importar mapas.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        base64: true,
      })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      // Monta objeto compatível com o restante do código
      setArquivo({
        uri:      asset.uri,
        name:     asset.fileName ?? ('mapa_' + Date.now() + '.jpg'),
        mimeType: asset.mimeType ?? 'image/jpeg',
        size:     asset.fileSize ?? null,
        _base64:  asset.base64,
      })
    } catch (e) {
      Alert.alert('Erro ao acessar galeria', e?.message ?? String(e))
    }
  }

  // Upload para Supabase Storage e salva no banco
  async function handleCarregar() {
    if (!arquivo) return
    setUploading(true)
    setProgress(0.1)
    try {
      // 1. Usa base64 retornado pelo ImagePicker
      const base64 = arquivo._base64
      setProgress(0.3)

      // 2. Converte para Uint8Array
      const binaryStr = atob(base64)
      const bytes     = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      setProgress(0.4)

      // 3. Upload para Storage
      const ext      = (arquivo.name ?? 'mapa').split('.').pop()?.toLowerCase() ?? 'pdf'
      const mimeType = arquivo.mimeType || 'application/octet-stream'
      const filePath = workspaceId + '/' + Date.now() + '.' + ext

      const { error: upErr } = await supabase.storage
        .from('mapas-lider')
        .upload(filePath, bytes.buffer, { contentType: mimeType, upsert: false })
      if (upErr) throw upErr
      setProgress(0.8)

      // 4. URL publica
      const { data: { publicUrl } } = supabase.storage
        .from('mapas-lider')
        .getPublicUrl(filePath)

      // 5. Salva metadados — nome = nome do arquivo sem extensao
      const nome = (arquivo.name ?? 'Mapa').replace(/\.[^.]+$/, '')
      const { error: dbErr } = await supabase.from('lider_mapas').insert({
        workspace_id:  workspaceId,
        nome,
        tipo:          'outro',
        imagem_url:    publicUrl,
        tamanho_bytes: arquivo.size ?? null,
        sw_lat: 0, sw_lng: 0, ne_lat: 0, ne_lng: 0,
      })
      if (dbErr) throw dbErr

      setProgress(1)
      Alert.alert('Mapa carregado!', '"' + nome + '" adicionado com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      Alert.alert('Erro ao carregar', e?.message ?? String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={st.root}>

      {/* Area de selecao — toque abre os arquivos do Android */}
      <TouchableOpacity
        style={[st.picker, arquivo ? st.pickerAtivo : null]}
        onPress={selecionarArquivo}
        activeOpacity={0.75}
        disabled={uploading}
      >
        <View style={[st.iconWrap, arquivo ? st.iconWrapAtivo : null]}>
          <Ionicons
            name={arquivo ? 'document-text' : 'document-text-outline'}
            size={52}
            color={arquivo ? C.primary : C.textMuted}
          />
        </View>

        {arquivo ? (
          <>
            <Text style={st.fileName} numberOfLines={2}>{arquivo.name}</Text>
            <Text style={st.fileSub}>
              {arquivo.size ? ((arquivo.size / 1024).toFixed(0) + ' KB  |  ') : ''}Toque para trocar
            </Text>
          </>
        ) : (
          <>
            <Text style={st.pickerTitle}>Selecionar mapa</Text>
            <Text style={st.pickerSub}>PNG, JPG — imagens de mapa</Text>
            <View style={st.pickerCta}>
              <Ionicons name="images-outline" size={15} color={C.primary} />
              <Text style={st.pickerCtaTxt}>Abrir galeria</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Barra de progresso */}
      {uploading ? (
        <View style={st.progressWrap}>
          <View style={[st.progressBar, { width: Math.round(progress * 100) + '%' }]} />
          <Text style={st.progressTxt}>
            {progress < 0.4 ? 'Preparando...' : progress < 0.8 ? 'Enviando...' : 'Salvando...'}
          </Text>
        </View>
      ) : null}

      {/* Botao principal */}
      <TouchableOpacity
        style={[st.btn, (!arquivo || uploading) ? st.btnDisabled : null]}
        onPress={handleCarregar}
        disabled={!arquivo || uploading}
        activeOpacity={0.85}
      >
        {uploading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
        }
        <Text style={st.btnTxt}>
          {uploading ? 'Carregando...' : 'Carregar mapa'}
        </Text>
      </TouchableOpacity>

    </View>
  )
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' },
  picker:       { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 36, minHeight: 240, marginBottom: 20 },
  pickerAtivo:  { borderStyle: 'solid', borderColor: C.primary },
  iconWrap:     { width: 88, height: 88, borderRadius: 44, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  iconWrapAtivo: { borderColor: C.primary },
  pickerTitle:  { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  pickerSub:    { fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 16 },
  pickerCta:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  pickerCtaTxt: { fontSize: 13, fontWeight: '700', color: C.primary },
  fileName:     { fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 6 },
  fileSub:      { fontSize: 12, color: C.textMuted, textAlign: 'center' },
  progressWrap: { backgroundColor: C.bgCard, borderRadius: 10, borderWidth: 1, borderColor: C.border, height: 40, overflow: 'hidden', justifyContent: 'center', marginBottom: 16 },
  progressBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.greenBg },
  progressTxt:  { textAlign: 'center', fontSize: 13, fontWeight: '600', color: C.text, zIndex: 1 },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 18 },
  btnDisabled:  { opacity: 0.4 },
  btnTxt:       { fontSize: 16, fontWeight: '700', color: '#fff' },
})
