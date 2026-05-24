import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'

type Step = 'camera' | 'preview' | 'enviando' | 'sucesso'

export default function NovoBoletimScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [step, setStep] = useState<Step>('camera')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const cameraRef = useRef<CameraView>(null)

  async function tirarFoto() {
    if (!cameraRef.current) return
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false })
    if (photo) {
      setPhotoUri(photo.uri)
      setStep('preview')
    }
  }

  async function enviarBoletim() {
    if (!photoUri) return
    setStep('enviando')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // Upload da foto para Supabase Storage
      const fileName = `boletins/${user.id}/${Date.now()}.jpg`
      const response = await fetch(photoUri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('maquinas')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false })

      if (uploadError) throw uploadError

      // Obter URL pública e criar registro
      const { data: { publicUrl } } = supabase.storage.from('maquinas').getPublicUrl(fileName)

      const { error: insertError } = await supabase
        .from('maquinas_boletins')
        .insert({ imagem_url: publicUrl, status: 'aguardando', user_id: user.id })

      if (insertError) throw insertError

      setStep('sucesso')
    } catch (err: unknown) {
      setStep('preview')
      Alert.alert('Erro ao enviar', err instanceof Error ? err.message : 'Tente novamente.')
    }
  }

  // Permissão de câmera não decidida ainda
  if (!permission) return <View style={styles.container} />

  // Permissão negada
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: '#FFFFFF' }]}>
        <Ionicons name="camera-outline" size={56} color="#D1D5DB" />
        <Text style={[styles.permText, { color: '#0D1B2A' }]}>Permissão de câmera necessária</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Permitir câmera</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Sucesso
  if (step === 'sucesso') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: '#FFFFFF' }]}>
        <Ionicons name="checkmark-circle" size={72} color="#22C55E" />
        <Text style={[styles.successTitle, { color: '#0D1B2A' }]}>Boletim enviado!</Text>
        <Text style={[styles.successSub, { color: '#6B7280' }]}>O OCR está processando. Você será notificado.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/')}>
          <Text style={styles.buttonText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Preview da foto
  if (step === 'preview' && photoUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.outlineButton} onPress={() => setStep('camera')}>
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.outlineText}>Repetir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={enviarBoletim}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Enviar boletim</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Enviando
  if (step === 'enviando') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: '#FFFFFF' }]}>
        <ActivityIndicator size="large" color="#06B6D4" />
        <Text style={[styles.loadingText, { color: '#6B7280' }]}>Enviando e processando OCR...</Text>
      </View>
    )
  }

  // Camera
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.guide}>
            <Text style={styles.guideText}>Centralize o boletim na moldura</Text>
            <View style={styles.guideBorder} />
          </View>
          <TouchableOpacity style={styles.captureButton} onPress={tirarFoto}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1923' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  camera: { flex: 1 },
  overlay: {
    flex: 1, backgroundColor: 'transparent',
    justifyContent: 'space-between', padding: 24, paddingBottom: 48,
  },
  closeButton: {
    alignSelf: 'flex-start', marginTop: 44,
    backgroundColor: '#00000060', borderRadius: 20, padding: 6,
  },
  guide: { alignItems: 'center', gap: 12 },
  guideText: { color: '#fff', fontSize: 13, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4 },
  guideBorder: {
    width: 280, height: 200, borderWidth: 2,
    borderColor: '#3B82F6', borderRadius: 12,
    borderStyle: 'dashed',
  },
  captureButton: {
    alignSelf: 'center', width: 72, height: 72,
    borderRadius: 36, backgroundColor: '#ffffff40',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  preview: { flex: 1 },
  previewActions: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#0D1B2A', borderRadius: 12, padding: 14,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  outlineButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  outlineText: { color: '#0D1B2A', fontWeight: '600', fontSize: 15 },
  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  successSub: { fontSize: 14, color: '#4A5568', textAlign: 'center' },
  loadingText: { color: '#4A5568', fontSize: 14, marginTop: 12 },
})
