import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, todayISO } from '../../src/lib/theme'

interface Produto { id: string; nome: string; unidade: string }
const URGENCIAS = [
  { id: 'normal',   label: 'Normal',  color: C.blue   },
  { id: 'urgente',  label: 'Urgente', color: C.yellow },
  { id: 'critico',  label: 'Crítico', color: C.red    },
]

export default function SolicitarInsumoScreen() {
  const nav         = useNavigation()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const [produtos,  setProdutos]  = useState<Produto[]>([])
  const [produto,   setProduto]   = useState<Produto | null>(null)
  const [quantidade,setQuantidade]= useState('')
  const [urgencia,  setUrgencia]  = useState('normal')
  const [dataNec,   setDataNec]   = useState(todayISO())
  const [obs,       setObs]       = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Solicitar Insumo' }) }, [])

  useEffect(() => {
    supabase.from('lider_produtos').select('id, nome, unidade').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => { setProdutos(data ?? []); setLoading(false) })
  }, [])

  async function handleSolicitar() {
    if (!turnoAtivo) return
    if (!produto)   { Alert.alert('Atenção', 'Selecione o produto'); return }
    if (!quantidade){ Alert.alert('Atenção', 'Informe a quantidade'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    const { error } = await supabase.from('lider_solicitacoes_insumo').insert({
      turno_id:         turnoAtivo.id,
      workspace_id:     workspaceId,
      tipo_solicitacao: 'insumo',
      produto_id:       produto.id,
      descricao:        produto.nome,
      quantidade:       parseFloat(quantidade) || 0,
      unidade:          produto.unidade,
      urgencia,
      data_necessaria:  dataNec,
      observacao:       obs,
      criado_por:       user.user?.id,
      status:           'pendente',
    })

    if (error) Alert.alert('Erro', error.message)
    else {
      Alert.alert('Solicitação Enviada', `${produto.nome} solicitado com sucesso!`)
      setProduto(null); setQuantidade(''); setObs(''); setUrgencia('normal')
    }
    setSaving(false)
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SectionLabel>Produto</SectionLabel>
        {produtos.map(p => (
          <TouchableOpacity key={p.id} style={[styles.card, produto?.id === p.id && styles.cardActive]} onPress={() => setProduto(p)} activeOpacity={0.8}>
            <Text style={[styles.cardTitle, produto?.id === p.id && { color: C.primaryDark }]}>{p.nome}</Text>
            <Text style={styles.cardSub}>{p.unidade}</Text>
          </TouchableOpacity>
        ))}

        <SectionLabel>Quantidade {produto ? `(${produto.unidade})` : ''}</SectionLabel>
        <TextInput style={styles.input} value={quantidade} onChangeText={setQuantidade} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMuted} />

        <SectionLabel>Urgência</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {URGENCIAS.map(u => (
            <TouchableOpacity key={u.id} style={[styles.urgCard, urgencia === u.id && { borderColor: u.color, backgroundColor: u.color + '18' }]} onPress={() => setUrgencia(u.id)}>
              <Text style={[styles.urgText, urgencia === u.id && { color: u.color, fontWeight: '700' }]}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionLabel>Data Necessária</SectionLabel>
        <TextInput style={styles.input} value={dataNec} onChangeText={setDataNec} placeholder="AAAA-MM-DD" placeholderTextColor={C.textMuted} />

        <SectionLabel>Justificativa</SectionLabel>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={obs} onChangeText={setObs} multiline placeholder="Por que precisa deste insumo?" placeholderTextColor={C.textMuted} />

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSolicitar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar Solicitação</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{children}</Text>
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:       { backgroundColor: C.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardActive: { borderColor: C.primary, backgroundColor: C.greenBg },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: C.text },
  cardSub:    { fontSize: 12, color: C.textSub },
  input:      { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.bgCard, marginBottom: 20 },
  urgCard:    { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  urgText:    { fontSize: 13, color: C.textSub, fontWeight: '600' },
  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:        { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
})
