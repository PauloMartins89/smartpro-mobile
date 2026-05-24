import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { supabase } from '../../src/lib/supabase'

export default function PerfilScreen() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair', style: 'destructive',
        onPress: async () => {
          setLoading(true)
          await supabase.auth.signOut()
          setLoading(false)
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Perfil</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#EF4444" />
          : <Text style={styles.logoutText}>Sair da conta</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D1B2A', marginTop: 52, marginBottom: 24 },
  logoutButton: {
    backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
})
