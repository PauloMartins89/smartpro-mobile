import { Tabs, useRouter } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import useLiderStore from '../../src/store/useLiderStore'
import { C, TURNO_LABEL } from '../../src/lib/theme'
import RightDrawer from '../../src/components/RightDrawer'

export default function TabsLayout() {
  const router        = useRouter()
  const turnoAtivo    = useLiderStore(s => s.turnoAtivo)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Se não há turno ativo → redireciona para seleção
  useEffect(() => {
    if (!turnoAtivo) router.replace('/turno/novo')
  }, [])

  if (!turnoAtivo) return null

  return (
    <View style={{ flex: 1 }}>
      {/* Barra de contexto persistente */}
      <View style={styles.contextBar}>
        <View style={styles.contextPill}>
          <View style={styles.contextDot} />
          <Text style={styles.contextText}>
            {turnoAtivo.frente_nome} · Equipe {turnoAtivo.equipe_nome} · {TURNO_LABEL[turnoAtivo.turno]}
          </Text>
        </View>
        <View style={styles.contextActions}>
          <TouchableOpacity onPress={() => router.push('/turno/novo')} style={styles.contextBtn}>
            <Ionicons name="swap-horizontal-outline" size={17} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.contextBtn}>
            <Ionicons name="stats-chart-outline" size={17} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor:   C.primary,
          tabBarInactiveTintColor: C.textSub,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="apontamentos"
          options={{
            title: 'Apontamentos',
            tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="fab"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={styles.fab}>
                <Ionicons name="add" size={30} color="#fff" />
              </View>
            ),
            tabBarLabel: () => null,
          }}
          listeners={{ tabPress: e => { e.preventDefault(); router.push('/apontamento/index') } }}
        />
        <Tabs.Screen
          name="solicitacoes"
          options={{
            title: 'Solicitações',
            tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="mais"
          options={{
            title: 'Mais',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
      </Tabs>

      {/* Painel lateral direito — resumo do turno em tempo real */}
      <RightDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        turnoAtivo={turnoAtivo}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  contextBar:     { backgroundColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 10 },
  contextPill:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  contextDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginRight: 8 },
  contextText:    { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  contextActions: { flexDirection: 'row', gap: 4 },
  contextBtn:     { width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  tabBar:         { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 20 : 6, height: Platform.OS === 'ios' ? 82 : 64 },
  fab:            { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 20 : 12, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
})
