import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

const ATIVIDADES = ['Plantio', 'Colheita', 'Pulverização', 'Adubação', 'Capina', 'Irrigação', 'Outra']

export default function ProdutividadeEquipeScreen() {
  const nav        = useNavigation()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)

  const [atividade,    setAtividade]    = useState(ATIVIDADES[0])
  const [metaHa,       setMetaHa]       = useState('')
  const [realizadoHa,  setRealizadoHa]  = useState('')
  const [motivoDesvio, setMotivoDesvio] = useState('')
  const [obs,          setObs]          = useState('')
  const [saving,       setSaving]       = useState(false)

  const eficiencia = metaHa && realizadoHa && parseFloat(metaHa) > 0
    ? Math.round((parseFloat(realizadoHa) / parseFloat(metaHa)) * 100)
    : null

  useEffect(() => { nav.setOptions({ title: 'Produtividade da Equipe' }) }, [])

  async function handleSalvar() {
    if (!turnoAtivo) { Alert.alert('Atenção', 'Nenhum turno ativo'); return }
    if (!metaHa || !realizadoHa) { Alert.alert('Atenção', 'Informe meta e realizado'); return }

    setSaving(true)
    const workspaceId = useLiderStore.getState().workspaceId

    const { error } = await supabase.from('lider_produtividade_equipe').insert({
      turno_id:       turnoAtivo.id,
      workspace_id:   workspaceId,
      equipe_id:      turnoAtivo.equipe_id,
      equipe_nome:    turnoAtivo.equipe_nome,
      atividade,
      meta_ha:        parseFloat(metaHa),
      realizado_ha:   parseFloat(realizadoHa),
      eficiencia_pct: eficiencia,
      motivo_desvio:  eficiencia !== null && eficiencia < 100 ? motivoDesvio : null,
      observacao:     obs || null,
    })

    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      Alert.alert('Salvo!', 'Produtividade registrada.')
      setMetaHa(''); setRealizadoHa(''); setMotivoDesvio(''); setObs('')
    }
    setSaving(false)
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Section label="Atividade">
          <View style={styles.chipRow}>
            {ATIVIDADES.map(a => (
              <TouchableOpacity key={a} style={[styles.chip, atividade === a && styles.chipActive]} onPress={() => setAtividade(a)}>
                <Text style={[styles.chipText, atividade === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <View style={styles.row2}>
          <Section label="Meta do Dia (ha)" style={{ flex: 1, marginRight: 8 }}>
            <TextInput style={styles.input} value={metaHa} onChangeText={setMetaHa}
              keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
          </Section>
          <Section label="Realizado (ha)" style={{ flex: 1 }}>
            <TextInput style={styles.input} value={realizadoHa} onChangeText={setRealizadoHa}
              keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={C.textMuted} />
          </Section>
        </View>

        {/* Eficiência calculada */}
        {eficiencia !== null && (
          <View style={[styles.eficCard, { backgroundColor: eficiencia >= 100 ? C.greenBg : eficiencia >= 70 ? C.yellowBg : C.redBg }]}>
            <Text style={[styles.eficLabel, { color: eficiencia >= 100 ? C.greenText : eficiencia >= 70 ? C.yellowText : C.redText }]}>
              Eficiência
            </Text>
            <Text style={[styles.eficValue, { color: eficiencia >= 100 ? C.greenText : eficiencia >= 70 ? C.yellowText : C.redText }]}>
              {eficiencia}%
            </Text>
          </View>
        )}

        {/* Motivo de desvio — só aparece se < 100% */}
        {eficiencia !== null && eficiencia < 100 && (
          <Section label="Motivo do Desvio">
            <TextInput style={[styles.input, { minHeight: 70 }]}
              value={motivoDesvio} onChangeText={setMotivoDesvio}
              multiline placeholder="Por que não atingiu a meta?" placeholderTextColor={C.textMuted} />
          </Section>
        )}

        <Section label="Observação">
          <TextInput style={[styles.input, { minHeight: 60 }]}
            value={obs} onChangeText={setObs}
            multiline placeholder="Opcional" placeholderTextColor={C.textMuted} />
        </Section>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSalvar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar Produtividade</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Section({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ marginBottom: 20 }, style]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  row2:           { flexDirection: 'row' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.bgMuted },
  chipActive:     { borderColor: C.primary, backgroundColor: C.greenBg },
  chipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTextActive: { color: C.primaryDark },
  input:          { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: C.bgCard },
  eficCard:       { borderRadius: 12, padding: 16, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eficLabel:      { fontSize: 14, fontWeight: '600' },
  eficValue:      { fontSize: 32, fontWeight: '800' },
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:            { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },
})
