// @ts-nocheck
import { Stack } from 'expo-router'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
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

export default function DDSLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800', fontSize: 16 },
        headerLeft: () => <BackButton />,
      }}
    />
  )
}
