import { Tabs, useRouter } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import useLiderStore from '../../src/store/useLiderStore'
import { C, TURNO_LABEL } from '../../src/lib/theme'
import RightDrawer from '../../src/components/RightDrawer'

export default function TabsLayout() {
  const router              = useRouter()
  const turnoAtivo          = useLiderStore(s => s.turnoAtivo)
  const triggerDashRefresh  = useLiderStore(s => s.triggerDashRefresh)
  const hasHydrated         = useLiderStore(s => s._hasHydrated)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Aguarda hidratação do AsyncStorage antes de decidir rota
  useEffect(() => {
    if (!hasHydrated) return
    if (!turnoAtivo) router.replace('/turno/novo')
  }, [hasHydrated])

  // Ainda carregando store do AsyncStorage
  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  if (!turnoAtivo) return null

  return (
    <View style={{ flex: 1 }}>
      {/* Barra de contexto persistente */}
      <View style={styles.contextBar}>
        <View style={styles.contextLeft}>
          <View style={styles.contextRow}>
            <View style={styles.contextDot} />
            <Text style={styles.contextTitle} numberOfLines={1}>{turnoAtivo.frente_nome}</Text>
          </View>
          <Text style={styles.contextSub}>
            Equipe {turnoAtivo.equipe_nome} · Turno {TURNO_LABEL[turnoAtivo.turno] || turnoAtivo.turno}
          </Text>
        </View>
        <View style={styles.contextActions}>
          <TouchableOpacity style={styles.contextBtn} onPress={() => triggerDashRefresh()} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={19} color="rgba(255,255,255,0.85)" />
            <Text style={styles.contextBtnLabel}>Atualizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
            <Ionicons name="stats-chart-outline" size={19} color="rgba(255,255,255,0.85)" />
            <Text style={styles.contextBtnLabel}>Indicadores</Text>
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
  contextBar:      { backgroundColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 14 },
  contextLeft:     { flex: 1, marginRight: 8 },
  contextRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  contextDot:      { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary, marginRight: 8, flexShrink: 0 },
  contextTitle:    { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  contextSub:      { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500', marginLeft: 17 },
  contextActions:  { flexDirection: 'row', gap: 16 },
  contextBtn:      { alignItems: 'center', justifyContent: 'center', gap: 3 },
  contextBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '600' },
  tabBar:         { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 20 : 6, height: Platform.OS === 'ios' ? 82 : 64 },
  fab:            { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 20 : 12, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
})
