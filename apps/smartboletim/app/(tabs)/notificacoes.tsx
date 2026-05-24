import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function NotificacoesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Avisos</Text>
      <View style={styles.empty}>
        <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>Nenhum aviso no momento</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D1B2A', marginTop: 52, marginBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
})
