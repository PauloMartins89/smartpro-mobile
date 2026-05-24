import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { C } from '../../src/lib/theme'

const ITEMS = [
  { icon: 'restaurant-outline',       label: 'Refeição',  sub: 'Solicitar refeição para equipe',  route: '/solicitacao/refeicao' },
  { icon: 'cube-outline',             label: 'Insumo',    sub: 'Solicitar insumos com urgência',  route: '/solicitacao/insumo' },
  { icon: 'shield-checkmark-outline', label: 'EPI',       sub: 'Solicitar EPIs para colaborador', route: '/solicitacao/epi' },
]

export default function SolicitacoesScreen() {
  const router = useRouter()
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Solicitações</Text>
      {ITEMS.map(item => (
        <TouchableOpacity key={item.route} style={styles.card} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon as any} size={24} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardSub}>{item.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },
  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  iconWrap:  { width: 46, height: 46, borderRadius: 12, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  cardSub:   { fontSize: 12, color: C.textSub, marginTop: 2 },
})
