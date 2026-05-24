import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

interface Produto { id: string; nome: string; unidade: string; tipo: string }
interface Talhao  { id: string; codigo: string; nome: string }
interface Item    { produto_id: string; nome: string; unidade: string; quantidade: string; talhao_id: string; observacao: string }

export default function InsumoScreen() {
  const nav        = useNavigation()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)
  const workspaceId= useLiderStore(s => s.workspaceId)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [talhoes,  setTalhoes]  = useState<Talhao[]>([])
  const [itens,    setItens]    = useState<Item[]>([{ produto_id: '', nome: '', unidade: '', quantidade: '', talhao_id: '', observacao: '' }])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Apontamento de Insumo' }) }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('lider_produtos').select('id, nome, unidade, tipo').eq('workspace_id', workspaceId).eq('ativo', true).order('nome'),
      supabase.from('lider_talhoes').select('id, codigo, nome').eq('workspace_id', workspaceId).order('codigo'),
    ]).then(([{ data: prods }, { data: tals }]) => {
      setProdutos(prods ?? [])
      setTalhoes(tals  ?? [])
      setLoading(false)
    })
  }, [])

  function addItem() {
    setItens(prev => [...prev, { produto_id: '', nome: '', unidade: '', quantidade: '', talhao_id: '', observacao: '' }])
  }

  function updateItem(idx: number, patch: Partial<Item>) {
    setItens(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSalvar() {
    if (!turnoAtivo) return
    const invalidos = itens.filter(i => !i.produto_id || !i.quantidade)
    if (invalidos.length) { Alert.alert('Atenção', 'Preencha produto e quantidade em todos os itens'); return }
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    const inserts = itens.map(i => ({
      turno_id:    turnoAtivo.id,
      produto_id:  i.produto_id,
      quantidade:  parseFloat(i.quantidade) || 0,
      unidade:     i.unidade,
      talhao_id:   i.talhao_id || null,
      observacao:  i.observacao,
      criado_por:  user.user?.id,
    }))

    const { error } = await supabase.from('lider_apontamentos_insumo').insert(inserts)
    if (error) Alert.alert('Erro', error.message)
    else {
      Alert.alert('Sucesso', 'Insumos registrados!')
      setItens([{ produto_id: '', nome: '', unidade: '', quantidade: '', talhao_id: '', observacao: '' }])
    }
    setSaving(false)
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {itens.map((item, idx) => (
          <View key={idx} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={styles.cardTitle}>Item {idx + 1}</Text>
              {itens.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(idx)}>
                  <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>Remover</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Produto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {produtos.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, item.produto_id === p.id && styles.chipActive]}
                  onPress={() => updateItem(idx, { produto_id: p.id, nome: p.nome, unidade: p.unidade })}
                >
                  <Text style={[styles.chipText, item.produto_id === p.id && styles.chipTextActive]}>{p.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Quantidade</Text>
                <TextInput style={styles.input} value={item.quantidade} onChangeText={v => updateItem(idx, { quantidade: v })} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMuted} />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Unidade</Text>
                <TextInput style={styles.input} value={item.unidade} onChangeText={v => updateItem(idx, { unidade: v })} placeholder="L / kg / sc" placeholderTextColor={C.textMuted} />
              </View>
            </View>

            <Text style={styles.label}>Talhão</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {talhoes.map(t => (
                <TouchableOpacity key={t.id} style={[styles.chip, item.talhao_id === t.id && styles.chipActive]} onPress={() => updateItem(idx, { talhao_id: t.id })}>
                  <Text style={[styles.chipText, item.talhao_id === t.id && styles.chipTextActive]}>{t.codigo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addItem} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Adicionar Produto</Text>
        </TouchableOpacity>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={handleSalvar} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Registrar Insumos</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:          { backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardTitle:     { fontSize: 14, fontWeight: '700', color: C.text },
  label:         { fontSize: 11, fontWeight: '600', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  row2:          { flexDirection: 'row', gap: 10 },
  halfField:     { flex: 1 },
  input:         { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.text, backgroundColor: C.bgMuted, marginBottom: 8 },
  chip:          { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, backgroundColor: C.bgMuted },
  chipActive:    { borderColor: C.primary, backgroundColor: C.greenBg },
  chipText:      { fontSize: 12, fontWeight: '600', color: C.textSub },
  chipTextActive:{ color: C.primaryDark },
  addBtn:        { borderWidth: 1.5, borderColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed' },
  addBtnText:    { color: C.primary, fontWeight: '700', fontSize: 14 },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14 },
  btn:           { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
})
