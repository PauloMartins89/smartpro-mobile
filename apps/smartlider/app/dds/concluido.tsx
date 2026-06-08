// @ts-nocheck
/**
 * DDS — Tela 4: Concluído — resumo final
 */
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { C } from '../../src/lib/theme'

export default function DDSConcluidoScreen() {
  const nav    = useNavigation()
  const router = useRouter()
  const { temaTitulo, totalAssinantes, colaboradores: colabsParam } = useLocalSearchParams<{
    temaTitulo: string; totalAssinantes: string; colaboradores: string
  }>()

  const colaboradores: { id: string; nome: string }[] = colabsParam ? JSON.parse(colabsParam) : []
  const hoje = new Date().toLocaleDateString('pt-BR')

  useEffect(() => { nav.setOptions({ title: 'DDS Concluído ✅' }) }, [])

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 24, paddingBottom: 48, alignItems: 'center' }}>
      {/* Ícone de sucesso */}
      <View style={s.iconWrap}>
        <Ionicons name="checkmark-circle" size={72} color={C.green} />
      </View>

      <Text style={s.titulo}>DDS Registrado!</Text>
      <Text style={s.sub}>Todas as assinaturas foram coletadas com sucesso.</Text>

      {/* Card resumo */}
      <View style={s.card}>
        <Row label="Tema"       value={temaTitulo} />
        <Row label="Data"       value={hoje} />
        <Row label="Assinaturas" value={`${totalAssinantes} pessoa(s)`} />
      </View>

      {/* Lista de assinantes */}
      <View style={s.listaWrap}>
        <Text style={s.listaLabel}>Assinantes</Text>
        {colaboradores.map((c, i) => (
          <View key={c.id ?? i} style={s.listaRow}>
            <Ionicons name="checkmark-circle" size={18} color={C.green} />
            <Text style={s.listaNome}>{c.nome}</Text>
          </View>
        ))}
      </View>

      {/* Ações */}
      <TouchableOpacity
        style={s.btnHome}
        onPress={() => router.replace('/(tabs)')}
        activeOpacity={0.8}>
        <Ionicons name="home-outline" size={20} color="#fff" />
        <Text style={s.btnHomeText}>Voltar ao Início</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.btnNovo}
        onPress={() => router.replace('/dds')}
        activeOpacity={0.8}>
        <Text style={s.btnNovoText}>Novo DDS</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      <Text style={{ fontSize: 13, color: C.textSub, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  iconWrap:   { marginTop: 20, marginBottom: 16 },
  titulo:     { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 8 },
  sub:        { fontSize: 14, color: C.textSub, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  card:       { width: '100%', backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  listaWrap:  { width: '100%', backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: C.border },
  listaLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  listaRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  listaNome:  { fontSize: 14, color: C.text, fontWeight: '600' },
  btnHome:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.navy, borderRadius: 14, padding: 16, width: '100%', marginBottom: 12 },
  btnHomeText:{ fontSize: 16, fontWeight: '800', color: '#fff' },
  btnNovo:    { paddingVertical: 12 },
  btnNovoText:{ fontSize: 14, color: C.primary, fontWeight: '700', textDecorationLine: 'underline' },
})
