import { Stack } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { C } from '../../src/lib/theme'

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
    }} />
  )
}
