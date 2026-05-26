// @ts-nocheck
import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

/**
 * Error boundary global do Expo Router.
 * Captura qualquer render error e mostra tela de fallback
 * em vez de fechar o app silenciosamente.
 */
export default function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const router = useRouter()

  useEffect(() => {
    // Log em produção — se houver Sentry ou similar, registrar aqui
    console.error('[GlobalError]', error?.message, error?.stack)
  }, [error])

  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
      <Text style={styles.title}>Algo deu errado</Text>
      <Text style={styles.msg}>{error?.message || 'Erro desconhecido'}</Text>
      <TouchableOpacity style={styles.btn} onPress={retry}>
        <Text style={styles.btnText}>Tentar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => router.replace('/(auth)/login')}>
        <Text style={[styles.btnText, { color: '#94A3B8' }]}>Voltar ao login</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0D1B2A', justifyContent: 'center', alignItems: 'center', padding: 32 },
  title:        { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  msg:          { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 32 },
  btn:          { backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12, width: '100%', alignItems: 'center' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
})
