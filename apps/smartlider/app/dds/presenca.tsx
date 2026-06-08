// @ts-nocheck
/**
 * DDS — Tela 2: Selecionar quem estava presente
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

export default function DDSPresencaScreen() {
  const nav    = useNavigation()
  const router = useRouter()
  const { temaId, temaTitulo, temaCategoria } = useLocalSearchParams<{ temaId: string; temaTitulo: string; temaCategoria: string }>()

  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)
  const liderId     = useLiderStore(s => s.liderPerfil?.id)

  const [colaboradores, setColabs]    = useState([])
  const [selecionados,  setSel]       = useState<Set<string>>(new Set())
  const [loading,       setLoading]   = useState(true)
  const [saving,        setSaving]    = useState(false)

  useEffect(() => { nav.setOptions({ title: 'Quem estava presente?' }) }, [])

  const carregar = useCallback(async () => {
    if (!turnoAtivo) return
    setLoading(true)
    // Tenta buscar equipe do turno
    const equipeId = turnoAtivo.equipe_id
    const { data } = await supabase
      .from('lider_colaboradores')
      .select('id, nome, cargo')
      .eq('equipe_id', equipeId)
      .eq('ativo', true)
      .order('nome')
    const lista = data ?? []
    setColabs(lista)
    // Por padrão, todos selecionados
    setSel(new Set(lista.map(c => c.id)))
    setLoading(false)
  }, [turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  function toggleColab(id: string) {
    setSel(prev => {
      const novo = new Set(prev)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  async function continuar() {
    if (selecionados.size === 0) {
      alert('Selecione pelo menos um colaborador.'); return
    }
    setSaving(true)
    try {
      // Cria o registro DDS
      const hoje = new Date().toISOString().slice(0, 10)
      // Verifica se já existe
      const { data: existente } = await supabase
        .from('dds_registros')
        .select('id')
        .eq('turno_id', turnoAtivo.id)
        .eq('data', hoje)
        .maybeSingle()

      let registroId = existente?.id
      if (!registroId) {
        const { data: novo } = await supabase
          .from('dds_registros')
          .insert({ workspace_id: workspaceId, turno_id: turnoAtivo.id, lider_id: liderId ?? null, tema_id: temaId, data: hoje })
          .select('id')
          .single()
        registroId = novo?.id
      }

      if (!registroId) { alert('Erro ao criar registro. Tente novamente.'); return }

      // Monta lista dos presentes
      const presentes = colaboradores.filter(c => selecionados.has(c.id))
      router.push({
        pathname: '/dds/assinaturas',
        params: {
          registroId,
          temaTitulo,
          colaboradores: JSON.stringify(presentes.map(c => ({ id: c.id, nome: c.nome }))),
        },
      })
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  )

  const qtdSel = selecionados.size

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Header do tema */}
      <View style={s.temaBox}>
        <Text style={s.temaLabel}>Tema do DDS</Text>
        <Text style={s.temaTitulo}>{temaTitulo}</Text>
        {temaCategoria ? <Text style={s.temaCat}>{temaCategoria}</Text> : null}
      </View>

      <Text style={s.sectionLabel}>
        Selecione quem estava presente ({qtdSel}/{colaboradores.length})
      </Text>

      {colaboradores.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={40} color={C.textMuted} />
          <Text style={s.emptyText}>Nenhum colaborador encontrado na equipe deste turno.</Text>
        </View>
      )}

      {colaboradores.map(c => {
        const sel = selecionados.has(c.id)
        return (
          <TouchableOpacity
            key={c.id}
            style={[s.colabRow, sel && s.colabRowSel]}
            onPress={() => toggleColab(c.id)}
            activeOpacity={0.75}>
            <View style={[s.check, sel && s.checkSel]}>
              {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.colabNome}>{c.nome}</Text>
              {c.cargo ? <Text style={s.colabFuncao}>{c.cargo}</Text> : null}
            </View>
          </TouchableOpacity>
        )
      })}

      {/* Atalhos */}
      <View style={s.atalhos}>
        <TouchableOpacity onPress={() => setSel(new Set(colaboradores.map(c => c.id)))}>
          <Text style={s.atalhoText}>Selecionar todos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSel(new Set())}>
          <Text style={s.atalhoText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[s.btnContinuar, (qtdSel === 0 || saving) && { opacity: 0.4 }]}
        onPress={continuar}
        disabled={qtdSel === 0 || saving}
        activeOpacity={0.8}>
        {saving
          ? <ActivityIndicator size="small" color="#fff" />
          : <>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={s.btnText}>Ir para Assinaturas ({qtdSel}) →</Text>
            </>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  temaBox:       { backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  temaLabel:     { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  temaTitulo:    { fontSize: 16, fontWeight: '800', color: C.text },
  temaCat:       { fontSize: 12, color: C.textSub, marginTop: 3 },
  sectionLabel:  { fontSize: 12, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  colabRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  colabRowSel:   { borderColor: C.primary, backgroundColor: C.greenBg },
  check:         { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkSel:      { backgroundColor: C.primary, borderColor: C.primary },
  colabNome:     { fontSize: 14, fontWeight: '700', color: C.text },
  colabFuncao:   { fontSize: 12, color: C.textSub, marginTop: 2 },
  atalhos:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4, marginBottom: 16 },
  atalhoText:    { fontSize: 13, color: C.primary, fontWeight: '600' },
  empty:         { alignItems: 'center', padding: 40, gap: 12 },
  emptyText:     { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  btnContinuar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.navy, borderRadius: 14, padding: 16, marginTop: 4 },
  btnText:       { fontSize: 16, fontWeight: '800', color: '#fff' },
})
