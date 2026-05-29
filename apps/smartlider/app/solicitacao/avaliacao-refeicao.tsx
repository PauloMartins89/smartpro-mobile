// @ts-nocheck
import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { C } from '../../src/lib/theme'

const API_URL = 'https://smartpro.app.br/api/refeicoes'

function fmtDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${Number(d)} de ${meses[Number(m)-1]}. de ${y}`
}

// ── Componente estrelas ──────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={st.starsRow}>
      {[1,2,3,4,5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={42}
            color={n <= value ? '#F59E0B' : C.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const STAR_LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente!']

// ── Componente questão sim/não ───────────────────────────────────────────────
function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={st.ynRow}>
      <Text style={st.ynLabel}>{label}</Text>
      <View style={st.ynBtns}>
        <TouchableOpacity
          onPress={() => onChange(true)}
          style={[st.ynBtn, value === true && st.ynBtnActiveYes]}>
          <Ionicons name="checkmark" size={16} color={value === true ? '#fff' : C.textSub} />
          <Text style={[st.ynBtnText, value === true && { color: '#fff' }]}>Sim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange(false)}
          style={[st.ynBtn, value === false && st.ynBtnActiveNo]}>
          <Ionicons name="close" size={16} color={value === false ? '#fff' : C.textSub} />
          <Text style={[st.ynBtnText, value === false && { color: '#fff' }]}>Não</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Tela principal ───────────────────────────────────────────────────────────
export default function AvaliacaoRefeicaoScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()

  const avaliacaoId  = params.id as string
  const numero       = params.numero  as string || ''
  const restaurante  = params.restaurante as string || ''
  const dataRefeicao = params.data as string || ''
  const obrigatorio  = params.obrigatorio === '1'

  const [nota,         setNota]        = useState(0)
  const [qtdCorreta,   setQtdCorreta]  = useState<boolean | null>(null)
  const [tempOk,       setTempOk]      = useState<boolean | null>(null)
  const [saborOk,      setSaborOk]     = useState<boolean | null>(null)
  const [observacao,   setObs]         = useState('')
  const [saving,       setSaving]      = useState(false)

  async function handleSubmit() {
    if (nota === 0) {
      Alert.alert('Avaliação obrigatória', 'Por favor, dê uma nota geral (1 a 5 estrelas).')
      return
    }
    setSaving(true)
    try {
      const resp = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:             'responder-avaliacao',
          id:                 avaliacaoId,
          nota_geral:         nota,
          quantidade_correta: qtdCorreta,
          temperatura_ok:     tempOk,
          sabor_ok:           saborOk,
          observacao:         observacao.trim() || null,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Erro ao salvar')

      Alert.alert('Obrigado! 🙏', 'Sua avaliação foi registrada.', [
        {
          text: 'OK',
          onPress: () => {
            // Se obrigatória (bloqueou novo pedido) → vai para o formulário de pedido
            // Se não (acessou voluntariamente) → volta
            if (obrigatorio) {
              router.replace('/solicitacao/refeicao')
            } else {
              router.canGoBack() ? router.back() : router.replace('/(tabs)')
            }
          },
        },
      ])
    } catch (err) {
      Alert.alert('Erro', err.message || 'Tente novamente')
      setSaving(false)
    }
  }

  function handlePularPorAgora() {
    // Só chama quando não é obrigatório (não deve aparecer quando obrigatorio=1)
    router.canGoBack() ? router.back() : router.replace('/(tabs)')
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      {/* Banner obrigatório */}
      {obrigatorio && (
        <View style={st.banner}>
          <Ionicons name="information-circle" size={18} color="#fff" />
          <Text style={st.bannerText}>
            Responda a avaliação do pedido anterior para fazer um novo pedido.
          </Text>
        </View>
      )}

      {/* Cabeçalho do pedido */}
      <View style={st.orderCard}>
        <View style={st.orderRow}>
          <Ionicons name="receipt-outline" size={18} color={C.primary} />
          <Text style={st.orderNum}>{numero || 'Pedido anterior'}</Text>
        </View>
        {restaurante ? (
          <View style={st.orderRow}>
            <Ionicons name="restaurant-outline" size={15} color={C.textSub} />
            <Text style={st.orderSub}>{restaurante}</Text>
          </View>
        ) : null}
        {dataRefeicao ? (
          <View style={st.orderRow}>
            <Ionicons name="calendar-outline" size={15} color={C.textSub} />
            <Text style={st.orderSub}>{fmtDate(dataRefeicao)}</Text>
          </View>
        ) : null}
      </View>

      {/* Nota geral */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>Como foi a refeição?</Text>
        <Text style={st.sectionSub}>Toque em uma estrela para avaliar</Text>
        <StarRating value={nota} onChange={setNota} />
        {nota > 0 && (
          <Text style={[st.starLabel, { color: nota >= 4 ? C.primary : nota >= 3 ? C.yellow : C.red }]}>
            {STAR_LABELS[nota]}
          </Text>
        )}
      </View>

      {/* Questões sim/não */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>Detalhes</Text>
        <YesNo
          label="A quantidade de marmitas estava correta?"
          value={qtdCorreta}
          onChange={setQtdCorreta}
        />
        <View style={st.divider} />
        <YesNo
          label="A temperatura estava adequada?"
          value={tempOk}
          onChange={setTempOk}
        />
        <View style={st.divider} />
        <YesNo
          label="Sabor e apresentação foram bons?"
          value={saborOk}
          onChange={setSaborOk}
        />
      </View>

      {/* Observação */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>Observações <Text style={st.optional}>(opcional)</Text></Text>
        <TextInput
          style={st.input}
          placeholder="Descreva problemas ou elogios..."
          placeholderTextColor={C.textMuted}
          multiline
          numberOfLines={3}
          maxLength={500}
          value={observacao}
          onChangeText={setObs}
          textAlignVertical="top"
        />
      </View>

      {/* Botões */}
      <TouchableOpacity
        style={[st.btnSubmit, saving && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={st.btnSubmitText}>Enviar Avaliação</Text>}
      </TouchableOpacity>

      {!obrigatorio && (
        <TouchableOpacity style={st.btnSkip} onPress={handlePularPorAgora}>
          <Text style={st.btnSkipText}>Lembrar depois</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F59E0B', borderRadius: 10, padding: 12,
  },
  bannerText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 13 },

  orderCard: {
    backgroundColor: C.bgCard, borderRadius: 12, padding: 14, gap: 6,
    borderWidth: 1, borderColor: C.border,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNum: { fontSize: 16, fontWeight: '700', color: C.text },
  orderSub: { fontSize: 14, color: C.textSub },

  section: {
    backgroundColor: C.bgCard, borderRadius: 12, padding: 16, gap: 10,
    borderWidth: 1, borderColor: C.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  sectionSub:   { fontSize: 12, color: C.textSub, marginTop: -6 },
  optional:     { fontSize: 12, color: C.textMuted, fontWeight: '400' },

  starsRow:  { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  starLabel: { textAlign: 'center', fontSize: 15, fontWeight: '700', marginTop: 2 },

  ynRow:   { gap: 8 },
  ynLabel: { fontSize: 14, color: C.text, lineHeight: 20 },
  ynBtns:  { flexDirection: 'row', gap: 8 },
  ynBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg,
  },
  ynBtnActiveYes: { backgroundColor: C.primary, borderColor: C.primary },
  ynBtnActiveNo:  { backgroundColor: C.red,     borderColor: C.red },
  ynBtnText: { fontSize: 14, fontWeight: '600', color: C.textSub },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },

  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    padding: 10, fontSize: 14, color: C.text, minHeight: 80,
    backgroundColor: C.bg,
  },

  btnSubmit: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  btnSkip: { alignItems: 'center', paddingVertical: 10 },
  btnSkipText: { color: C.textSub, fontSize: 14 },
})
