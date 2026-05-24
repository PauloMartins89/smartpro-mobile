import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, calcVolumeLha } from '../../src/lib/theme'

interface Implemento { id: string; codigo: string; modelo: string; tipo: string }

export default function AfericaoScreen() {
  const nav         = useNavigation()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const [implementos, setImplementos] = useState<Implemento[]>([])
  const [impl,      setImpl]      = useState<Implemento | null>(null)
  const [vazao,     setVazao]     = useState('')
  const [velocidade,setVelocidade]= useState('')
  const [largura,   setLargura]   = useState('')
  const [observacao,setObservacao]= useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Aferição de Implemento' }) }, [])

  useEffect(() => {
    supabase.from('lider_implementos').select('id, codigo, modelo, tipo').eq('workspace_id', workspaceId).eq('ativo', true).order('codigo')
      .then(({ data }) => { setImplementos(data ?? []); setLoading(false) })
  }, [])

  const volLha = calcVolumeLha(parseFloat(vazao) || 0, parseFloat(velocidade) || 0, parseFloat(largura) || 0)

  async function handleSalvar() {
    if (!turnoAtivo) return
    if (!impl)    { Alert.alert('Atenção', 'Selecione o implemento'); return }
    if (!vazao)   { Alert.alert('Atenção', 'Informe a vazão'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    const { error } = await supabase.from('lider_afericoes').insert({
      turno_id:        turnoAtivo.id,
      implemento_id:   impl.id,
      vazao_lmin:      parseFloat(vazao)      || null,
      velocidade_kmh:  parseFloat(velocidade) || null,
      largura_m:       parseFloat(largura)    || null,
      volume_lha:      volLha || null,
      observacao,
      criado_por:      user.user?.id,
    })

    if (error) Alert.alert('Erro', error.message)
    else {
      Alert.alert('Aferição Salva', `Volume calculado: ${volLha} L/ha`)
      setVazao(''); setVelocidade(''); setLargura(''); setImpl(null); setObservacao('')
    }
    setSaving(false)
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Implemento */}
        <Text style={styles.sectionLabel}>Implemento</Text>
        {implementos.map(i => (
          <TouchableOpacity key={i.id} style={[styles.card, impl?.id === i.id && styles.cardActive]} onPress={() => setImpl(i)} activeOpacity={0.8}>
            <Text style={[styles.cardTitle, impl?.id === i.id && { color: C.primaryDark }]}>{i.codigo} · {i.modelo}</Text>
            <Text style={styles.cardSub}>{i.tipo}</Text>
          </TouchableOpacity>
        ))}

        {/* Medições */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Medições</Text>
        <View style={styles.row3}>
          <View style={styles.thirdField}>
            <Text style={styles.label}>Vazão (L/min)</Text>
            <TextInput style={styles.input} value={vazao} onChangeText={setVazao} keyboardType="numeric" placeholder="0.0" placeholderTextColor={C.textMuted} />
          </View>
          <View style={styles.thirdField}>
            <Text style={styles.label}>Veloc. (km/h)</Text>
            <TextInput style={styles.input} value={velocidade} onChangeText={setVelocidade} keyboardType="numeric" placeholder="0.0" placeholderTextColor={C.textMuted} />
          </View>
          <View style={styles.thirdField}>
            <Text style={styles.label}>Largura (m)</Text>
            <TextInput style={styles.input} value={largura} onChangeText={setLargura} keyboardType="numeric" placeholder="0.0" placeholderTextColor={C.textMuted} />
          </View>
        </View>

        {/* Resultado calculado */}
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Volume Calculado</Text>
          <Text style={styles.resultValue}>{volLha > 0 ? `${volLha} L/ha` : '—'}</Text>
          <Text style={styles.resultFormula}>Fórmula: (Vazão × 60) ÷ (Velocidade × Largura)</Text>
        </View>

        <Text style={styles.label}>Observação</Text>
        <TextInput style={[styles.input, { minHeight: 60 }]} value={observacao} onChangeText={setObservacao} multiline placeholder="Condições, bicos, pressão..." placeholderTextColor={C.textMuted} />

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSalvar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Registrar Aferição</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card:         { backgroundColor: C.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: C.border },
  cardActive:   { borderColor: C.primary, backgroundColor: C.greenBg },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub:      { fontSize: 11, color: C.textSub, marginTop: 2 },
  row3:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  thirdField:   { flex: 1 },
  label:        { fontSize: 11, fontWeight: '600', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:        { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.text, backgroundColor: C.bgMuted, marginBottom: 8 },
  resultCard:   { backgroundColor: C.navy, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  resultLabel:  { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  resultValue:  { color: C.primary, fontSize: 32, fontWeight: '800', marginVertical: 4 },
  resultFormula:{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center' },
  footer:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:          { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
})
