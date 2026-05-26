import { Stack, useRouter } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { C } from '../../src/lib/theme'

function BackButton() {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="chevron-back" size={26} color="#fff" />
    </TouchableOpacity>
  )
}

function SmartProHeader() {
  return (
    <View style={hst.wrap}>
      <Text style={hst.brand}>SmartPro</Text>
      <Text style={hst.sub}>GESTÃO OPERACIONAL INTELIGENTE</Text>
    </View>
  )
}

const hst = StyleSheet.create({
  wrap:  { alignItems: 'center' },
  brand: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  sub:   { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, marginTop: -1 },
})

export default function SolicitacaoLayout() {
  return (
    <Stack screenOptions={{
      headerStyle:      { backgroundColor: C.navy },
      headerTintColor:  '#fff',
      headerTitle:      () => <SmartProHeader />,
      headerTitleStyle: { fontWeight: '700' },
      headerLeft:       () => <BackButton />,
    }} />
  )
}
