// @ts-nocheck
/**
 * DDS — Tela 1: Selecionar tema e ler conteúdo
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Alert,
} from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

const CAT_COLOR: Record<string, string> = {
  'Segurança':    '#ef4444',
  'Saúde':        '#3b82f6',
  'Meio Ambiente':'#22c55e',
  'Qualidade':    '#f59e0b',
  'Outros':       '#8b5cf6',
}

export default function DDSIndexScreen() {
  const nav         = useNavigation()
  const router      = useRouter()
  const insets      = useSafeAreaInsets()
  const turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const workspaceId = useLiderStore(s => s.workspaceId)

  const [temas,    setTemas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [lido,     setLido]     = useState(false)
  const [jaFeito,  setJaFeito]  = useState(null) // registro já concluído hoje

  useEffect(() => { nav.setOptions({ title: 'DDS — Diálogo de Segurança' }) }, [])

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const [{ data: temasData }, { data: regHoje }] = await Promise.all([
      supabase.from('dds_temas').select('*').eq('workspace_id', workspaceId).eq('ativo', true).order('categoria').order('titulo'),
      turnoAtivo ? supabase.from('dds_registros')
        .select('*, dds_temas(titulo, categoria)')
        .eq('turno_id', turnoAtivo.id)
        .eq('status', 'concluido')
        .maybeSingle() : Promise.resolve({ data: null }),
    ])
    setTemas(temasData ?? [])
    setJaFeito(regHoje ?? null)
    setLoading(false)
  }, [workspaceId, turnoAtivo?.id])

  useEffect(() => { carregar() }, [carregar])

  function continuar() {
    if (!selected) { Alert.alert('Selecione um tema', 'Escolha o tema do DDS antes de continuar.'); return }
    router.push({ pathname: '/dds/presenca', params: { temaId: selected.id, temaTitulo: selected.titulo, temaCategoria: selected.categoria, temaGrupoId: selected.grupo_id ?? '' } })
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  )

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>

      {/* Aviso: DDS já feito hoje */}
      {jaFeito && (
        <View style={s.bannerOk}>
          <Ionicons name="checkmark-circle" size={20} color={C.green} />
          <Text style={s.bannerOkText}>
            DDS concluído hoje: <Text style={{ fontWeight: '800' }}>{jaFeito.dds_temas?.titulo}</Text>
            {' — '}{jaFeito.total_assinantes} assinatura(s)
          </Text>
        </View>
      )}

      {/* Sem turno ativo */}
      {!turnoAtivo && (
        <View style={s.bannerWarn}>
          <Ionicons name="warning-outline" size={18} color={C.yellow} />
          <Text style={s.bannerWarnText}>Abra um turno antes de realizar o DDS.</Text>
        </View>
      )}

      <Text style={s.sectionLabel}>Selecione o tema de hoje</Text>

      {temas.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="document-text-outline" size={40} color={C.textMuted} />
          <Text style={s.emptyText}>Nenhum tema cadastrado.{'\n'}Acesse o painel web → Cadastros → DDS.</Text>
        </View>
      )}

      {temas.map(t => {
        const cor = CAT_COLOR[t.categoria] ?? C.primary
        const ativo = selected?.id === t.id
        return (
          <TouchableOpacity
            key={t.id}
            style={[s.temaCard, ativo && { borderColor: cor, borderWidth: 2 }]}
            onPress={() => { setSelected(t); setLido(false) }}
            activeOpacity={0.8}>
            <View style={[s.catDot, { backgroundColor: cor }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.temaTitulo}>{t.titulo}</Text>
              <Text style={s.temaCat}>{t.categoria}</Text>
            </View>
            {ativo && <Ionicons name="checkmark-circle" size={22} color={cor} />}
          </TouchableOpacity>
        )
      })}

      {/* Conteúdo do tema selecionado */}
      {selected && (
        <View style={s.conteudoBox}>
          <Text style={s.conteudoTitulo}>{selected.titulo}</Text>
          {selected.imagem_url ? (
            <Image
              source={{ uri: selected.imagem_url }}
              style={s.img}
              resizeMode="cover"
            />
          ) : null}
          {selected.conteudo ? (
            <Text style={s.conteudoTexto}>{selected.conteudo}</Text>
          ) : (
            <Text style={[s.conteudoTexto, { color: C.textMuted, fontStyle: 'italic' }]}>
              Nenhum texto cadastrado para este tema.
            </Text>
          )}
          {!lido && (
            <TouchableOpacity style={s.btnLido} onPress={() => setLido(true)} activeOpacity={0.8}>
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={s.btnLidoText}>Li e compreendi o tema</Text>
            </TouchableOpacity>
          )}
          {lido && (
            <View style={s.lidoOk}>
              <Ionicons name="checkmark-circle" size={18} color={C.green} />
              <Text style={[s.btnLidoText, { color: C.green }]}>Leitura confirmada ✓</Text>
            </View>
          )}
        </View>
      )}

      {/* Botão continuar */}
      <TouchableOpacity
        style={[s.btnContinuar, (!selected || !lido || !turnoAtivo) && { opacity: 0.4 }]}
        onPress={continuar}
        disabled={!selected || !lido || !turnoAtivo}
        activeOpacity={0.8}>
        <Ionicons name="people-outline" size={20} color="#fff" />
        <Text style={s.btnContinuarText}>Coletar Assinaturas →</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerOk:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenBg, borderRadius: 10, padding: 12, marginBottom: 14 },
  bannerOkText:   { fontSize: 13, color: C.greenText, flex: 1 },
  bannerWarn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.yellowBg, borderRadius: 10, padding: 12, marginBottom: 14 },
  bannerWarnText: { fontSize: 13, color: C.yellowText, flex: 1 },
  sectionLabel:   { fontSize: 12, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  temaCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  catDot:         { width: 10, height: 10, borderRadius: 5 },
  temaTitulo:     { fontSize: 14, fontWeight: '700', color: C.text },
  temaCat:        { fontSize: 12, color: C.textSub, marginTop: 2 },
  conteudoBox:    { backgroundColor: C.bgCard, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border },
  conteudoTitulo: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 12 },
  img:            { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  conteudoTexto:  { fontSize: 14, color: C.text, lineHeight: 22 },
  btnLido:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, padding: 13, marginTop: 16 },
  btnLidoText:    { fontSize: 14, fontWeight: '800', color: '#fff' },
  lidoOk:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  empty:          { alignItems: 'center', padding: 40, gap: 12 },
  emptyText:      { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  btnContinuar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.navy, borderRadius: 14, padding: 16, marginTop: 20 },
  btnContinuarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
})
