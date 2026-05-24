import { Stack } from 'expo-router'
import { C } from '../../src/lib/theme'

export default function ApontamentoLayout() {
  return (
    <Stack screenOptions={{
      headerStyle:      { backgroundColor: C.navy },
      headerTintColor:  '#fff',
      headerTitleStyle: { fontWeight: '700' },
    }} />
  )
}
