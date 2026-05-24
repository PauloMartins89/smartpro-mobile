import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

const CRITERIOS = [
  { key: 'pontualidade',    label: 'Pontualidade',    icon: 'time-outline' },
  { key: 'produtividade',   label: 'Produtividade',   icon: 'trending-up-outline' },
  { key: 'seguranca',       label: 'Segurança',       icon: 'shield-checkmark-outline' },
  { key: 'limpeza',         label: 'Limpeza',         icon: 'sparkles-outline' },
  { key: 'comunicacao',     label: 'Comunicação',     icon: 'chatbubble-outline' },
  { key: 'trabalho_equipe', label: 'Trabalho em Equipe', icon: 'people-outline' },
] as const

type Criterio = typeof CRITERIOS[number]['key']

export default function AvaliacaoEquipeScreen() {
  const nav        = useNavigation()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)
  const [notas,  setNotas]  = useState<Record<string, number>>(Object.fromEntries(CRITERIOS.map(c => [c.key, 0])))
  const [obs,    setObs]    = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Avaliação da Equipe' }) }, [])

  const mediaGeral = CRITERIOS.reduce((s, c) => s + (notas[c.key] ?? 0), 0) / CRITERIOS.length

  async function handleSalvar() {
    if (!turnoAtivo) return
    const zerados = CRITERIOS.filter(c => !notas[c.key])
    if (zerados.length) { Alert.alert('Atenção', 'Avalie todos os critérios antes de salvar'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    const { error } = await supabase.from('lider_avaliacoes_equipe').insert({
      turno_id:         turnoAtivo.id,
      equipe_id:        turnoAtivo.equipe_id,
      nota_pontualidade:    notas.pontualidade,
      nota_produtividade:   notas.produtividade,
      nota_seguranca:       notas.seguranca,
      nota_limpeza:         notas.limpeza,
      nota_comunicacao:     notas.comunicacao,
      nota_trabalho_equipe: notas.trabalho_equipe,
      nota_geral:           Math.round(mediaGeral * 10) / 10,
      observacao:           obs,
      criado_por:           user.user?.id,
    })

    if (error) Alert.alert('Erro', error.message)
    else Alert.alert('Avaliação Salva!', `Nota geral: ${(Math.round(mediaGeral * 10) / 10).toFixed(1)}/5`)
    setSaving(false)
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {CRITERIOS.map(c => (
          <View key={c.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name={c.icon as any} size={18} color={C.primary} />
              </View>
              <Text style={styles.cardTitle}>{c.label}</Text>
              {notas[c.key] > 0 && (
                <View style={[styles.notaBadge, { backgroundColor: notaColor(notas[c.key]) + '20' }]}>
                  <Text style={[styles.notaBadgeText, { color: notaColor(notas[c.key]) }]}>{notas[c.key].toFixed(1)}</Text>
                </View>
              )}
            </View>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setNotas(prev => ({ ...prev, [c.key]: n }))} style={styles.starBtn}>
                  <Ionicons name={notas[c.key] >= n ? 'star' : 'star-outline'} size={30} color={notas[c.key] >= n ? '#F59E0B' : C.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Nota Geral */}
        <View style={styles.geralCard}>
          <Text style={styles.geralLabel}>Nota Geral</Text>
          <Text style={[styles.geralValue, { color: notaColor(mediaGeral) }]}>
            {mediaGeral > 0 ? mediaGeral.toFixed(1) : '—'}
          </Text>
          <Text style={styles.geralSub}>/5.0</Text>
        </View>

        <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Observação Geral</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={obs} onChangeText={setObs}
          multiline placeholder="Pontos fortes e de melhoria..."
          placeholderTextColor={C.textMuted}
        />
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSalvar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar Avaliação</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function notaColor(nota: number) {
  if (nota >= 4) return C.green
  if (nota >= 3) return C.yellow
  return C.red
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  card:          { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconWrap:      { width: 34, height: 34, borderRadius: 8, backgroundColor: C.greenBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cardTitle:     { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  notaBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  notaBadgeText: { fontSize: 14, fontWeight: '800' },
  starsRow:      { flexDirection: 'row', gap: 6 },
  starBtn:       { padding: 2 },
  geralCard:     { backgroundColor: C.navy, borderRadius: 16, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  geralLabel:    { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  geralValue:    { fontSize: 40, fontWeight: '800' },
  geralSub:      { color: 'rgba(255,255,255,0.4)', fontSize: 16, alignSelf: 'flex-end', paddingBottom: 6 },
  input:         { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.bgCard, marginBottom: 16 },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:           { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
})
