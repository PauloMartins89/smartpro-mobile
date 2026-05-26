import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

const ITEMS = [
  { icon: 'document-text-outline', label: 'Fechar Dia / Boletim', route: '/fechamento' },
  { icon: 'terminal-outline',      label: 'Diagnóstico / Logs',   route: '/diagnostico' },
]

export default function MaisScreen() {
  const router     = useRouter()
  const setTurno   = useLiderStore(s => s.setTurnoAtivo)

  async function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        setTurno(null)
        await supabase.auth.signOut()
        router.replace('/(auth)/login')
      }},
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Mais</Text>
      {ITEMS.map(item => (
        <TouchableOpacity key={item.route} style={styles.card} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon as any} size={22} color={C.primary} />
          </View>
          <Text style={styles.cardLabel}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.card, styles.logoutCard]} onPress={handleLogout} activeOpacity={0.8}>
        <View style={[styles.iconWrap, { backgroundColor: C.redBg }]}>
          <Ionicons name="log-out-outline" size={22} color={C.red} />
        </View>
        <Text style={[styles.cardLabel, { color: C.red }]}>Sair</Text>
        <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  title:       { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  logoutCard:  { marginTop: 16 },
  iconWrap:    { width: 46, height: 46, borderRadius: 12, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardLabel:   { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
})
