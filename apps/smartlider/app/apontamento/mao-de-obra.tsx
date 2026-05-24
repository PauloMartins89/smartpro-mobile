// @ts-nocheck — rebuilt clean
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Switch, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

interface ColabRow {
  colaborador_id: string
  nome: string
  matricula: string
  funcao: string
  presente: boolean
  horas_trabalhadas: number
  observacao: string
  id?: string  // mao_obra record id (se já salvo)
}

// ──────────────────────────────────────────────
// Stepper card por categoria de função
// ──────────────────────────────────────────────
function FuncaoStepper({
  label, icon, total, presentes,
  onAdd, onRemove,
}: {
  label: string
  icon: string
  total: number
  presentes: number
  onAdd: () => void
  onRemove: () => void
}) {
  const ausentes = total - presentes
  return (
    <View style={st.stepCard}>
      <View style={st.stepIconWrap}>
        <Ionicons name={icon as any} size={18} color={C.primary} />
      </View>
      <Text style={st.stepLabel}>{label}</Text>
      <Text style={st.stepTotal}>{total} cadastrados</Text>
      <View style={st.stepControls}>
        <TouchableOpacity
          style={[st.stepBtn, presentes === 0 && st.stepBtnDisabled]}
          onPress={onRemove}
          disabled={presentes === 0}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={18} color={presentes === 0 ? C.textMuted : C.red} />
        </TouchableOpacity>
        <View style={st.stepCounter}>
          <Text style={st.stepCountNum}>{presentes}</Text>
          <Text style={st.stepCountSub}>presentes</Text>
        </View>
        <TouchableOpacity
          style={[st.stepBtn, presentes === total && st.stepBtnDisabled]}
          onPress={onAdd}
          disabled={presentes === total}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={presentes === total ? C.textMuted : C.primary} />
        </TouchableOpacity>
      </View>
      {ausentes > 0 && (
        <Text style={st.stepAusentes}>{ausentes} ausente{ausentes > 1 ? 's' : ''}</Text>
      )}
    </View>
  )
}

export default function MaoDeObraScreen() {
  const nav        = useNavigation()
  const turnoAtivo = useLiderStore(s => s.turnoAtivo)
  const [rows,     setRows]    = useState<ColabRow[]>([])
  const [loading,  setLoading] = useState(true)
  const [saving,   setSaving]  = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Mão de Obra' }) }, [])

  // ── Helpers de categoria ──────────────────────────
  function isFuncao(funcao: string, cat: 'oper' | 'aux') {
    const f = funcao.toLowerCase()
    return cat === 'oper' ? f.includes('oper') : f.includes('aux')
  }

  function countPresentes(cat: 'oper' | 'aux') {
    return rows.filter(r => isFuncao(r.funcao, cat) && r.presente).length
  }
  function countTotal(cat: 'oper' | 'aux') {
    return rows.filter(r => isFuncao(r.funcao, cat)).length
  }

  /** Marca o próximo colaborador ausente da categoria como presente */
  function addPresente(cat: 'oper' | 'aux') {
    setRows(prev => {
      const copia = [...prev]
      const idx = copia.findIndex(r => isFuncao(r.funcao, cat) && !r.presente)
      if (idx >= 0) copia[idx] = { ...copia[idx], presente: true }
      return copia
    })
  }

  /** Marca o último colaborador presente da categoria como ausente */
  function removePresente(cat: 'oper' | 'aux') {
    setRows(prev => {
      const copia = [...prev]
      // último presente dessa categoria
      let lastIdx = -1
      copia.forEach((r, i) => { if (isFuncao(r.funcao, cat) && r.presente) lastIdx = i })
      if (lastIdx >= 0) copia[lastIdx] = { ...copia[lastIdx], presente: false }
      return copia
    })
  }

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)

    // Busca colaboradores da equipe
    const { data: colabs } = await supabase.from('lider_colaboradores')
      .select('id, nome, matricula, funcao')
      .eq('equipe_id', turnoAtivo.equipe_id)
      .eq('ativo', true)
      .order('nome')

    // Busca registros já lançados neste turno
    const { data: lancados } = await supabase.from('lider_mao_obra')
      .select('id, colaborador_id, presente, horas_trabalhadas, observacao')
      .eq('turno_id', turnoAtivo.id)

    const mapa = Object.fromEntries((lancados ?? []).map(l => [l.colaborador_id, l]))

    setRows((colabs ?? []).map(c => ({
      colaborador_id:  c.id,
      nome:            c.nome,
      matricula:       c.matricula ?? '',
      funcao:          c.funcao    ?? '',
      presente:        mapa[c.id]?.presente        ?? true,
      horas_trabalhadas: mapa[c.id]?.horas_trabalhadas ?? 8,
      observacao:      mapa[c.id]?.observacao      ?? '',
      id:              mapa[c.id]?.id,
    })))
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  function update(idx: number, patch: Partial<ColabRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  async function handleSalvar() {
    if (!turnoAtivo) return
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    const upserts = rows.map(r => ({
      id:                r.id,
      turno_id:          turnoAtivo.id,
      colaborador_id:    r.colaborador_id,
      presente:          r.presente,
      horas_trabalhadas: r.presente ? r.horas_trabalhadas : 0,
      observacao:        r.observacao,
      criado_por:        user.user?.id,
    }))

    const { error } = await supabase.from('lider_mao_obra').upsert(upserts, { onConflict: 'turno_id,colaborador_id' })

    if (error) Alert.alert('Erro', error.message)
    else       Alert.alert('Sucesso', 'Mão de obra salva com sucesso!')
    setSaving(false)
    carregar()
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>

  const totalPresentes = rows.filter(r => r.presente).length

  // ── Cabeçalho com steppers de operadores/auxiliares ──
  const stepHeader = (
    <View style={styles.stepSection}>
      <Text style={styles.stepSectionTitle}>Resumo da Equipe</Text>
      <View style={styles.stepRow}>
        <FuncaoStepper
          label="Operadores"
          icon="construct-outline"
          total={countTotal('oper')}
          presentes={countPresentes('oper')}
          onAdd={() => addPresente('oper')}
          onRemove={() => removePresente('oper')}
        />
        <FuncaoStepper
          label="Auxiliares"
          icon="people-outline"
          total={countTotal('aux')}
          presentes={countPresentes('aux')}
          onAdd={() => addPresente('aux')}
          onRemove={() => removePresente('aux')}
        />
      </View>

      {/* Linha total */}
      <View style={styles.totalBar}>
        <Ionicons name="checkmark-circle" size={14} color={C.primary} />
        <Text style={styles.totalBarText}>{totalPresentes} de {rows.length} colaboradores presentes</Text>
      </View>

      {rows.length > 0 && <Text style={styles.detalheLabel}>Detalhes individuais</Text>}
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={r => r.colaborador_id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={stepHeader}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.funcao}>{item.matricula} · {item.funcao}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Switch
                  value={item.presente}
                  onValueChange={v => update(index, { presente: v })}
                  trackColor={{ true: C.primary, false: C.border }}
                  thumbColor={item.presente ? C.primaryDark : '#ccc'}
                />
                <Text style={[styles.presTag, { color: item.presente ? C.greenText : C.redText }]}>
                  {item.presente ? 'Presente' : 'Ausente'}
                </Text>
              </View>
            </View>

            {item.presente && (
              <View style={styles.cardBody}>
                <View style={styles.horasRow}>
                  <Text style={styles.label}>Horas trabalhadas</Text>
                  <TextInput
                    style={styles.horasInput}
                    value={String(item.horas_trabalhadas)}
                    onChangeText={v => update(index, { horas_trabalhadas: parseFloat(v) || 0 })}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            <TextInput
              style={styles.obs}
              value={item.observacao}
              onChangeText={v => update(index, { observacao: v })}
              placeholder="Observação (opcional)"
              placeholderTextColor={C.textMuted}
              multiline
            />
          </View>
        )}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      <View style={styles.footer}>
        <Text style={styles.resumo}>{totalPresentes}/{rows.length} presentes</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleSalvar}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Salvar Mão de Obra</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  stepCard: {
    flex: 1, backgroundColor: C.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, alignItems: 'center', marginHorizontal: 4,
  },
  stepIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  stepLabel:       { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 },
  stepTotal:       { fontSize: 10, color: C.textMuted, marginBottom: 10 },
  stepControls:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepCounter:     { alignItems: 'center', minWidth: 44 },
  stepCountNum:    { fontSize: 26, fontWeight: '800', color: C.text },
  stepCountSub:    { fontSize: 10, color: C.textMuted },
  stepAusentes:    { fontSize: 10, color: C.redText, marginTop: 6, fontWeight: '600' },
})

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stepSection:      { marginBottom: 12 },
  stepSectionTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 10,
                      textTransform: 'uppercase', letterSpacing: 0.5 },
  stepRow:          { flexDirection: 'row', marginHorizontal: -4, marginBottom: 10 },
  totalBar:         { flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: C.greenBg, borderRadius: 10, padding: 10 },
  totalBarText:     { fontSize: 13, fontWeight: '600', color: C.greenText },
  detalheLabel:     { fontSize: 12, fontWeight: '700', color: C.textSub, marginTop: 14,
                      textTransform: 'uppercase', letterSpacing: 0.5 },
  card:             { backgroundColor: C.bgCard, borderRadius: 14, padding: 14,
                      marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardHeader:       { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  nome:             { fontSize: 15, fontWeight: '700', color: C.text },
  funcao:           { fontSize: 11, color: C.textSub, marginTop: 2 },
  presTag:          { fontSize: 10, fontWeight: '700', marginTop: 2 },
  cardBody:         { marginBottom: 8 },
  horasRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:            { fontSize: 13, color: C.textSub },
  horasInput:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 8,
                      paddingHorizontal: 12, paddingVertical: 6, width: 70,
                      textAlign: 'center', fontSize: 15, fontWeight: '700',
                      color: C.text, backgroundColor: C.bgMuted },
  obs:              { borderWidth: 1, borderColor: C.borderCard, borderRadius: 8,
                      padding: 8, fontSize: 12, color: C.text,
                      backgroundColor: C.bgMuted, minHeight: 36 },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0,
                      backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border,
                      padding: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14,
                      flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumo:           { fontSize: 13, fontWeight: '600', color: C.textSub },
  btn:              { flex: 1, backgroundColor: C.primary, borderRadius: 12,
                      paddingVertical: 14, alignItems: 'center' },
  btnText:          { color: '#fff', fontWeight: '700', fontSize: 15 },
})
