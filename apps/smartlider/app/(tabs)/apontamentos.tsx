import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useFeature } from '../../src/lib/useFeature'
import { C } from '../../src/lib/theme'

const ITEMS_BASE = [
  { icon: 'people-outline',            label: 'Mao de Obra',               sub: 'Presenca e horas trabalhadas',     route: '/apontamento/mao-de-obra' },
  { icon: 'construct-outline',         label: 'Maquina',                   sub: 'Horimetros e atividade',           route: '/apontamento/maquina' },
  { icon: 'flask-outline',             label: 'Insumo',                    sub: 'Produto, quantidade e area',       route: '/apontamento/insumo' },
  { icon: 'speedometer-outline',       label: 'Afericao',                  sub: 'Vazao, velocidade e volume L/ha',  route: '/apontamento/afericao' },
  { icon: 'shield-checkmark-outline',  label: 'Controle de EPI',           sub: 'Entrega, validade e situacao',     route: '/apontamento/controle-epi' },
  { icon: 'star-outline',              label: 'Avaliacao da Equipe',       sub: 'Pontualidade, producao e mais',    route: '/apontamento/avaliacao-equipe' },
  { icon: 'map-outline',               label: 'Produtividade Equipe',      sub: 'Atividade, meta e realizado ha',   route: '/apontamento/produtividade-equipe' },
  { icon: 'analytics-outline',         label: 'Produtividade Equipamento', sub: 'ha realizado vs meta por maquina', route: '/apontamento/produtividade-equipamento' },
]

export default function ApontamentosScreen() {
  const router          = useRouter()
  const showOcorrencias = useFeature('ocorrencias')

  const ITEMS = [
    ...ITEMS_BASE,
    showOcorrencias && { icon: 'warning-outline', label: 'Ocorrencias', sub: 'Quebras, acidentes e incidentes', route: '/apontamento/ocorrencia' },
  ].filter(Boolean)
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Apontamentos</Text>
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
