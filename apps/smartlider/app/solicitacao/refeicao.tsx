// @ts-nocheck
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
} from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C, fmtDate, TURNO_LABEL } from '../../src/lib/theme'

// ── Helpers ──────────────────────────────────────────────────────────────────
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtDateLong(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${Number(d)} de ${meses[Number(m)-1]}. de ${y}`
}
const API_URL = 'https://smartpro.app.br/api/refeicoes'

// ── Avatar com iniciais coloridas ────────────────────────────────────────────
const AVATAR_PALETTE = [
  { bg: '#DCFCE7', fg: '#166534' },
  { bg: '#DBEAFE', fg: '#1E40AF' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FED7AA', fg: '#C2410C' },
  { bg: '#CCFBF1', fg: '#0F766E' },
  { bg: '#FCE7F3', fg: '#9D174D' },
]
function avatarColor(nome: string) {
  const s = nome.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[s % AVATAR_PALETTE.length]
}
function initials(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function Avatar({ nome, size = 46 }: { nome: string; size?: number }) {
  const { bg, fg } = avatarColor(nome)
  return (
    <View style={[st.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[st.avatarText, { color: fg, fontSize: size * 0.3 }]}>{initials(nome)}</Text>
    </View>
  )
}

// ── Tela principal ───────────────────────────────────────────────────────────
export default function SolicitarRefeicaoScreen() {
  const nav         = useNavigation()
  const router      = useRouter()
  const _turnoAtivo  = useLiderStore(s => s.turnoAtivo)
  const _workspaceId = useLiderStore(s => s.workspaceId)
  // DEV MOCK: permite visualizar tela sem turno ativo
  const turnoAtivo  = _turnoAtivo  ?? (__DEV__ ? { id: 'mock', lider_nome: 'Líder Demo', equipe_nome: 'EQUIPE IRRIG', equipe_codigo: 'EQ-F07' } as any : null)
  const workspaceId = _workspaceId ?? (__DEV__ ? 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5' : '')

  const [loading,       setLoading]   = useState(true)
  const [saving,        setSaving]    = useState(false)
  const [colaboradores, setColab]     = useState([])
  const [restaurantes,  setRests]     = useState([])
  const [refeiEquipes,  setRefeiEq]   = useState([])
  const [refeiEquipeId, setRefeiEqId] = useState('')
  const [dataRefeicao,  setData]      = useState(tomorrowISO())
  const [restauranteId, setRestId]    = useState('')
  const [tipoEntrega,   setTipoEntrega] = useState<'entrega' | 'retirada'>('entrega')
  const [marcacoes,     setMarcacoes] = useState({})
  const [extras,        setExtras]    = useState([])
  const [observacoes,          setObs]                = useState('')
  const [restModalVisible,      setRestModalVisible]   = useState(false)
  const [supervisorTelefone,    setSupervisorTelefone] = useState('')

  // ── Carrega dados ────────────────────────────────────────────────────────
  useEffect(() => {
    nav.setOptions({ headerShown: false })
    if (!turnoAtivo) { setLoading(false); return }

    async function load() {
      const [{ data: equipes }, { data: rests }] = await Promise.all([
        supabase.from('refei_equipes')
          .select('id, cdc, nome, supervisor_telefone')
          .eq('workspace_id', workspaceId)
          .order('nome'),
        supabase.from('refei_restaurantes')
          .select('id, nome, valor_refeicao, valor_cafe')
          .eq('workspace_id', workspaceId)
          .eq('ativo', true)
          .order('nome'),
      ])

      setRefeiEq(equipes || [])
      const matchedEq = equipes?.find(
        e => e.cdc === turnoAtivo?.equipe_nome || e.cdc === turnoAtivo?.equipe_codigo
      )
      if (matchedEq) {
        setRefeiEqId(matchedEq.id)
        setSupervisorTelefone(matchedEq.supervisor_telefone || '')
      } else if (equipes && equipes.length === 1) {
        setRefeiEqId(equipes[0].id)
        setSupervisorTelefone(equipes[0].supervisor_telefone || '')
      }
      setRests(rests || [])
      if (rests && rests.length === 1) setRestId(rests[0].id)
      setLoading(false)
    }
    load()
  }, [])

  // ── Carrega colaboradores quando equipe muda ──────────────────────────────
  useEffect(() => {
    if (!refeiEquipeId) { setColab([]); setMarcacoes({}); return }
    supabase.from('refei_colaboradores')
      .select('id, nome, cargo')
      .eq('equipe_id', refeiEquipeId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        const lista = data || []
        setColab(lista)
        const defaults = {}
        lista.forEach(c => { defaults[c.id] = { refeicao: true, cafe: false } })
        setMarcacoes(defaults)
      })
  }, [refeiEquipeId])

  // ── Toggles ──────────────────────────────────────────────────────────────
  function toggleItem(id, campo) {
    setMarcacoes(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { refeicao: false, cafe: false }), [campo]: !prev[id]?.[campo] },
    }))
  }

  function addExtra() {
    setExtras(prev => [...prev, { _id: uuidv4(), nome: '', refeicao: true, cafe: false, justificativa: '' }])
  }
  function removeExtra(id) {
    setExtras(prev => prev.filter(e => e._id !== id))
  }
  function updateExtra(id, patch) {
    setExtras(prev => prev.map(e => e._id === id ? { ...e, ...patch } : e))
  }

  // ── Totais ────────────────────────────────────────────────────────────────
  const restauranteSel = restaurantes.find(r => r.id === restauranteId)

  const totais = useMemo(() => {
    let qtdRef = 0, qtdCafe = 0
    colaboradores.forEach(c => {
      const m = marcacoes[c.id] || {}
      if (m.refeicao) qtdRef++
      if (m.cafe) qtdCafe++
    })
    extras.forEach(e => {
      if (e.refeicao) qtdRef++
      if (e.cafe) qtdCafe++
    })
    const vRef  = Number(restauranteSel?.valor_refeicao || 0)
    const vCafe = Number(restauranteSel?.valor_cafe || 0)
    return { qtdRef, qtdCafe, total: qtdRef * vRef + qtdCafe * vCafe, vRef, vCafe }
  }, [marcacoes, extras, colaboradores, restauranteSel])

  // ── Submeter ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!turnoAtivo) return
    if (!restauranteId) { Alert.alert('Atencao', 'Selecione um restaurante'); return }
    if (totais.qtdRef + totais.qtdCafe === 0) {
      Alert.alert('Atencao', 'Marque pelo menos uma refeicao ou cafe')
      return
    }
    for (const e of extras) {
      if (!e.nome.trim()) { Alert.alert('Atencao', 'Informe o nome do colaborador extra'); return }
      if (!e.justificativa.trim()) {
        Alert.alert('Atencao', 'Justificativa obrigatoria para "' + e.nome + '"')
        return
      }
    }

    setSaving(true)
    try {
      const { data: userResp } = await supabase.auth.getUser()
      const userId = userResp.user?.id

      // Numero sequencial
      const { count } = await supabase
        .from('refei_solicitacoes')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('status', 'rascunho')
      const year = new Date().getFullYear()
      const numeroPedido = 'REF-' + year + '-' + String((count || 0) + 1).padStart(6, '0')

      // Cria solicitacao
      const { data: sol, error: solErr } = await supabase
        .from('refei_solicitacoes')
        .insert({
          workspace_id:         workspaceId,
          owner_id:             userId,
          lider_id:             userId,
          equipe_id:            refeiEquipeId || null,
          restaurante_id:       restauranteId,
          data_refeicao:        dataRefeicao,
          numero_pedido:        numeroPedido,
          status:               'aguardando_aprovacao',
          tipo_entrega:         tipoEntrega,
          total_refeicoes:      totais.qtdRef,
          total_cafes:          totais.qtdCafe,
          valor_refeicao:       totais.vRef,
          valor_cafe:           totais.vCafe,
          valor_total:          totais.total,
          observacoes:          observacoes || null,
          lider_nome:           turnoAtivo.lider_nome,
          supervisor_telefone:  supervisorTelefone || null,
          token_lider:          uuidv4(),
          token_aprovacao:      uuidv4(),
        })
        .select('id')
        .single()

      if (solErr) throw solErr

      // Tenta vincular turno (silencioso se coluna nao existir)
      supabase.from('refei_solicitacoes')
        .update({ turno_id: turnoAtivo.id })
        .eq('id', sol.id)
        .then(() => {})

      // Cria itens
      const itens = [
        ...colaboradores
          .filter(c => marcacoes[c.id]?.refeicao || marcacoes[c.id]?.cafe)
          .map(c => ({
            solicitacao_id:   sol.id,
            colaborador_id:   c.id,
            colaborador_nome: c.nome,
            refeicao:         !!marcacoes[c.id]?.refeicao,
            cafe:             !!marcacoes[c.id]?.cafe,
            extra:            false,
            justificativa:    null,
          })),
        ...extras.filter(e => e.refeicao || e.cafe).map(e => ({
          solicitacao_id:   sol.id,
          colaborador_id:   null,
          colaborador_nome: e.nome.trim(),
          refeicao:         e.refeicao,
          cafe:             e.cafe,
          extra:            true,
          justificativa:    e.justificativa.trim(),
        })),
      ]
      if (itens.length) {
        const { error: itensErr } = await supabase.from('refei_itens').insert(itens)
        if (itensErr) throw itensErr
      }

      // Dispara notificacoes WA (silencioso em falha)
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify-mobile', id: sol.id }),
      }).catch(() => {})

      // Navega para tela de status do pedido
      router.replace({
        pathname: '/solicitacao/pedido-status',
        params: {
          id:          sol.id,
          numero:      numeroPedido,
          equipe:      turnoAtivo.equipe_nome || turnoAtivo.equipe_codigo || '',
          restaurante: restauranteSel?.nome || '',
          qtdRef:      String(totais.qtdRef),
          qtdCafe:     String(totais.qtdCafe),
          total:       String(totais.total),
          data:        dataRefeicao,
        },
      })
    } catch (err) {
      Alert.alert('Erro ao enviar', err.message || 'Tente novamente')
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!turnoAtivo) {
    return (
      <View style={st.center}>
        <Ionicons name="alert-circle-outline" size={40} color={C.textMuted} />
        <Text style={{ color: C.textMuted, marginTop: 12 }}>Nenhum turno ativo</Text>
      </View>
    )
  }

  if (loading) {
    return <View style={st.center}><ActivityIndicator color={C.primary} size="large" /></View>
  }

  // Funções para toggle geral de todos os colaboradores
  function toggleTodos(campo: 'refeicao' | 'cafe') {
    const todosAtivos = colaboradores.every(c => marcacoes[c.id]?.[campo])
    setMarcacoes(prev => {
      const next = { ...prev }
      colaboradores.forEach(c => { next[c.id] = { ...(next[c.id] || { refeicao: false, cafe: false }), [campo]: !todosAtivos } })
      return next
    })
  }

  const todosMarcadosRef  = colaboradores.length > 0 && colaboradores.every(c => marcacoes[c.id]?.refeicao)
  const todosMarcadosCafe = colaboradores.length > 0 && colaboradores.every(c => marcacoes[c.id]?.cafe)

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero header escuro ── */}
        <View style={st.hero}>
          <View style={st.heroBody}>
            <Text style={st.heroTitle}>Solicitar Refeição</Text>
            <Text style={st.heroSub}>Selecione as opções e envie para aprovação.</Text>
            <View style={st.heroChips}>
              {turnoAtivo && (
                <View style={st.heroChip}>
                  <Ionicons name="people" size={12} color="#4ADE80" />
                  <Text style={st.heroChipText} numberOfLines={1}>
                    {turnoAtivo.equipe_codigo || turnoAtivo.equipe_nome || 'Equipe'} · {(TURNO_LABEL[turnoAtivo.turno] || turnoAtivo.turno || '').toUpperCase()}
                  </Text>
                </View>
              )}
              {turnoAtivo && (
                <View style={st.heroChip}>
                  <Ionicons name="person" size={12} color="#4ADE80" />
                  <Text style={st.heroChipText} numberOfLines={1}>{turnoAtivo.lider_email || turnoAtivo.lider_nome}</Text>
                </View>
              )}
            </View>
          </View>
        </View>


        {/* CONFIGURAÇÃO CARD */}
        <View style={st.card}>
          <View style={st.secHead}>
            <View style={st.secIcon}>
              <Ionicons name="settings-outline" size={18} color={C.primary} />
            </View>
            <Text style={st.secTitle}>CONFIGURAÇÃO</Text>
          </View>

          {/* Data + Restaurante */}
          <View style={st.configRow}>
            <View style={st.configCol}>
              <Text style={st.configLabel}>Data</Text>
              <View style={[st.configField, { paddingHorizontal: 6 }]}>
                <TouchableOpacity
                  onPress={() => { const d = new Date(dataRefeicao + 'T12:00:00'); d.setDate(d.getDate() - 1); setData(d.toISOString().slice(0, 10)) }}
                  style={st.dateArrow}
                >
                  <Ionicons name="chevron-back" size={16} color={C.textSub} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={13} color={C.textSub} />
                  <Text style={[st.configFieldText, { fontSize: 11, textAlign: 'center' }]} numberOfLines={1}>{fmtDateLong(dataRefeicao)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { const d = new Date(dataRefeicao + 'T12:00:00'); d.setDate(d.getDate() + 1); setData(d.toISOString().slice(0, 10)) }}
                  style={st.dateArrow}
                >
                  <Ionicons name="chevron-forward" size={16} color={C.textSub} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={st.configCol}>
              <Text style={st.configLabel}>Restaurante</Text>
              {restaurantes.length === 0
                ? <Text style={st.empty}>Nenhum cadastrado</Text>
                : <TouchableOpacity
                    style={[st.configField, restauranteId ? st.configFieldActive : {}]}
                    onPress={() => setRestModalVisible(true)}
                  >
                    <Ionicons name="storefront-outline" size={14} color={restauranteId ? C.primaryDark : C.textMuted} />
                    <Text style={[st.configFieldText, restauranteId ? { color: C.text } : {}, { flex: 1 }]} numberOfLines={1}>
                      {restauranteSel?.nome || 'Selecionar'}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color={C.textMuted} />
                  </TouchableOpacity>
              }
            </View>
          </View>

          {/* Price chips */}
          {restauranteSel && (
            <View style={st.priceRow}>
              {restauranteSel.valor_refeicao > 0 && (
                <View style={st.priceChip}>
                  <Text style={st.priceChipIcon}>🍴</Text>
                  <Text style={st.priceChipTxt}>{fmtBRL(restauranteSel.valor_refeicao)}/ref</Text>
                </View>
              )}
              {restauranteSel.valor_cafe > 0 && (
                <View style={st.priceChip}>
                  <Text style={st.priceChipIcon}>☕</Text>
                  <Text style={st.priceChipTxt}>{fmtBRL(restauranteSel.valor_cafe)}/café</Text>
                </View>
              )}
            </View>
          )}

          {/* Equipe (fixada ao turno) */}
          <View style={{ marginTop: 14 }}>
            <Text style={st.configLabel}>Equipe</Text>
            <View style={[st.configField, refeiEquipeId ? st.configFieldActive : {}]}>
              <Ionicons name="people-outline" size={14} color={refeiEquipeId ? C.primaryDark : C.textMuted} />
              <Text style={[st.configFieldText, refeiEquipeId ? { color: C.text } : {}, { flex: 1 }]} numberOfLines={1}>
                {refeiEquipes.find(e => e.id === refeiEquipeId)?.nome || turnoAtivo?.equipe_nome || 'Equipe'}
              </Text>
              <Ionicons name="lock-closed-outline" size={12} color={C.textMuted} />
            </View>
          </View>

          {/* Tipo de entrega */}
          <View style={{ marginTop: 14 }}>
            <Text style={st.configLabel}>Tipo de entrega</Text>
            <View style={st.entregaRow}>
              <TouchableOpacity
                style={[st.entregaBtn, tipoEntrega === 'entrega' && st.entregaBtnSel]}
                onPress={() => setTipoEntrega('entrega')}
                activeOpacity={0.75}
              >
                <Ionicons name="car-outline" size={14} color={tipoEntrega === 'entrega' ? C.primaryDark : C.textSub} />
                <Text style={[st.entregaBtnTxt, tipoEntrega === 'entrega' && st.entregaBtnTxtSel]}>Entrega</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.entregaBtn, tipoEntrega === 'retirada' && st.entregaBtnSel]}
                onPress={() => setTipoEntrega('retirada')}
                activeOpacity={0.75}
              >
                <Ionicons name="location-outline" size={14} color={tipoEntrega === 'retirada' ? C.primaryDark : C.textSub} />
                <Text style={[st.entregaBtnTxt, tipoEntrega === 'retirada' && st.entregaBtnTxtSel]}>Retirada</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* COLABORADORES CARD */}
        <View style={st.card}>
          <View style={st.colabHeader}>
            <View style={st.secIcon}>
              <Ionicons name="people-outline" size={15} color={C.primary} />
            </View>
            <Text style={st.colabTitle}>COLABORADORES ({colaboradores.length})</Text>
            {colaboradores.length > 0 && (
              <View style={st.todosRow}>
                <TouchableOpacity
                  style={[st.todosBtn, todosMarcadosRef  && { borderColor: C.primary,  backgroundColor: C.primary  + '22' }]}
                  onPress={() => toggleTodos('refeicao')}
                >
                  <Ionicons name="restaurant-outline" size={13} color={todosMarcadosRef  ? C.primary  : C.textMuted} />
                  <Text style={[st.todosBtnTxt, { color: todosMarcadosRef  ? C.primary  : C.textMuted }]}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.todosBtn, todosMarcadosCafe && { borderColor: '#F59E0B', backgroundColor: '#F59E0B22' }]}
                  onPress={() => toggleTodos('cafe')}
                >
                  <Ionicons name="cafe-outline" size={13} color={todosMarcadosCafe ? '#F59E0B' : C.textMuted} />
                  <Text style={[st.todosBtnTxt, { color: todosMarcadosCafe ? '#F59E0B' : C.textMuted }]}>Todos</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {colaboradores.length === 0
            ? <Text style={st.empty}>Nenhum colaborador na equipe</Text>
            : <View>
                {colaboradores.map((c, idx) => {
                  const m = marcacoes[c.id] || { refeicao: false, cafe: false }
                  const ausente = !(m.refeicao || m.cafe)
                  return (
                    <View key={c.id} style={[st.colabRow, idx === 0 && { paddingTop: 4 }, idx === colaboradores.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                      <Avatar nome={c.nome} />
                      <View style={[st.colabInfo, ausente && { opacity: 0.5 }]}>
                        <Text style={st.colabNome} numberOfLines={1}>{c.nome}</Text>
                        <Text style={st.colabFuncao}>{(c.cargo || 'COLABORADOR').toUpperCase()}</Text>
                      </View>
                      <View style={st.colabToggles}>
                        <TouchableOpacity
                          style={[st.togBtn, st.togFood, !m.refeicao && st.togInactive]}
                          onPress={() => toggleItem(c.id, 'refeicao')}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="restaurant-outline" size={20} color={m.refeicao ? '#22C55E' : '#CBD5E1'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[st.togBtn, st.togCafe, !m.cafe && st.togInactive]}
                          onPress={() => toggleItem(c.id, 'cafe')}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="cafe-outline" size={20} color={m.cafe ? '#F59E0B' : '#CBD5E1'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
              </View>
          }
        </View>

        {/* EXTRAS CARD */}
        <View style={[st.card, st.extrasCard]}>
          <View style={st.extrasHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="warning-outline" size={15} color="#D97706" />
                <Text style={st.extrasLabel}>PEDIDOS EXTRAS</Text>
              </View>
              <Text style={st.extrasSub}>Justificativa obrigatória</Text>
            </View>
            <TouchableOpacity style={st.addExtraBtn} onPress={addExtra} activeOpacity={0.8}>
              <Text style={st.addExtraTxt}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>
          {extras.map(e => (
            <View key={e._id} style={st.extraItem}>
              <View style={st.extraItemRow}>
                <TextInput
                  style={st.extraNomeInput}
                  value={e.nome}
                  onChangeText={v => updateExtra(e._id, { nome: v })}
                  placeholder="Nome do colaborador"
                  placeholderTextColor={C.textMuted}
                />
                <View style={st.extraBtns}>
                  <TouchableOpacity
                    style={[st.extraTypeBtn, e.refeicao && st.extraTypeBtnSel]}
                    onPress={() => updateExtra(e._id, { refeicao: !e.refeicao })}
                  >
                    <Text style={{ fontSize: 15 }}>🍴</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.extraTypeBtn, e.cafe && st.extraTypeBtnSel]}
                    onPress={() => updateExtra(e._id, { cafe: !e.cafe })}
                  >
                    <Text style={{ fontSize: 15 }}>☕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.extraRemoveBtn} onPress={() => removeExtra(e._id)}>
                    <Ionicons name="close" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={st.extraJustInput}
                value={e.justificativa}
                onChangeText={v => updateExtra(e._id, { justificativa: v })}
                placeholder="Justificativa obrigatória"
                placeholderTextColor="#CBD5E1"
              />
            </View>
          ))}
        </View>

        {/* OBSERVAÇÕES */}
        <View style={st.obsSection}>
          <Text style={st.obsLabel}>OBSERVAÇÕES (OPCIONAL)</Text>
          <TextInput
            style={st.obsInput}
            value={observacoes}
            onChangeText={setObs}
            multiline
            placeholder="Ex: João não virá amanhã, substituir por..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Modal — Restaurante */}
      <Modal
        visible={restModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRestModalVisible(false)}
      >
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setRestModalVisible(false)}>
          <View style={st.modalSheet}>
            <Text style={st.modalTitle}>Selecionar Restaurante</Text>
            {restaurantes.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[st.modalItem, restauranteId === r.id && st.modalItemSel]}
                onPress={() => { setRestId(r.id); setRestModalVisible(false) }}
                activeOpacity={0.75}
              >
                <Ionicons name="storefront-outline" size={18} color={restauranteId === r.id ? C.primaryDark : C.textSub} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.modalItemTxt, restauranteId === r.id && st.modalItemTxtSel]}>{r.nome}</Text>
                  {(r.valor_refeicao > 0 || r.valor_cafe > 0) && (
                    <Text style={st.modalItemSub}>
                      {r.valor_refeicao > 0 ? `🍴 ${fmtBRL(r.valor_refeicao)}` : ''}{r.valor_refeicao > 0 && r.valor_cafe > 0 ? '  ' : ''}{r.valor_cafe > 0 ? `☕ ${fmtBRL(r.valor_cafe)}` : ''}
                    </Text>
                  )}
                </View>
                {restauranteId === r.id && <Ionicons name="checkmark-circle" size={20} color={C.primaryDark} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Footer fixo */}
      <View style={st.footer}>
        <View style={st.kpiRow}>
          <View style={st.kpi}>
            <Text style={[st.kpiVal, { color: C.primary }]}>{totais.qtdRef}</Text>
            <Text style={st.kpiLabel}>refeições</Text>
          </View>
          <View style={st.kpiSep} />
          <View style={st.kpi}>
            <Text style={[st.kpiVal, { color: '#F59E0B' }]}>{totais.qtdCafe}</Text>
            <Text style={st.kpiLabel}>cafés</Text>
          </View>
          <View style={st.kpiSep} />
          <View style={st.kpi}>
            <Text style={[st.kpiVal, { fontSize: 17, color: C.primary }]}>{fmtBRL(totais.total)}</Text>
            <Text style={st.kpiLabel}>estimado</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[st.sendBtn, (totais.qtdRef + totais.qtdCafe === 0 || saving) && st.sendBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving || totais.qtdRef + totais.qtdCafe === 0}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="send-outline" size={17} color="#fff" />
                <Text style={st.sendBtnTxt}>Enviar para Aprovação</Text>
              </>
          }
        </TouchableOpacity>
        <Text style={st.footerNote}>Seguro, rastreável e sob sua gestão.</Text>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────
  root:    { flex: 1, backgroundColor: '#F0F4F8' },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:  { padding: 16, paddingTop: 14 },
  empty:   { fontSize: 13, color: C.textMuted, fontStyle: 'italic', paddingVertical: 8 },

  // ── Hero ──────────────────────────────────────────────
  hero:         { backgroundColor: '#0C1D32', paddingHorizontal: 20, paddingBottom: 18, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  heroNav:      { marginBottom: 8 },
  backBtn:      { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  heroBody:     { alignItems: 'center' },
  heroTitle:    { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 4 },
  heroSub:      { fontSize: 13, color: 'rgba(255,255,255,0.48)', marginBottom: 12 },
  heroChips:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  heroChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,197,94,0.14)', borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.35)', borderRadius: 50, paddingHorizontal: 13, paddingVertical: 7 },
  heroChipText: { fontSize: 11.5, fontWeight: '700', color: '#4ADE80', letterSpacing: 0.3 },

  // ── Card ──────────────────────────────────────────────
  card:         { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  secHead:      { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  secIcon:      { width: 34, height: 34, backgroundColor: '#F0FDF4', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secTitle:     { fontSize: 13, fontWeight: '800', color: '#0F172A', letterSpacing: 1.1 },

  // ── Config ────────────────────────────────────────────
  configRow:         { flexDirection: 'row', gap: 12, marginBottom: 12 },
  configCol:         { flex: 1, minWidth: 0 },
  configLabel:       { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.9 },
  configField:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E2E8F0', minHeight: 44 },
  dateArrow:         { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#EEF2F7' },
  configFieldActive: { borderColor: C.primary, backgroundColor: C.greenBg },
  configFieldText:   { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  configFieldTextActive: { fontSize: 12.5, fontWeight: '700', color: '#15803D' },

  // ── Price chips ───────────────────────────────────────
  priceRow:      { flexDirection: 'row', gap: 8, marginBottom: 2 },
  priceChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 },
  priceChipIcon: { fontSize: 14 },
  priceChipTxt:  { fontSize: 12.5, fontWeight: '600', color: '#475569' },

  // ── Entrega toggle ────────────────────────────────────
  entregaRow:      { flexDirection: 'row', gap: 10 },
  entregaBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12 },
  entregaBtnSel:   { backgroundColor: '#F0FDF4', borderColor: C.primary },
  entregaBtnTxt:   { fontSize: 13, fontWeight: '700', color: '#64748B' },
  entregaBtnTxtSel: { color: '#15803D' },

  // ── Colaboradores ─────────────────────────────────────
  colabHeader:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  colabTitle:    { flex: 1, fontSize: 11.5, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3, textTransform: 'uppercase' },
  todosRow:      { flexDirection: 'row', gap: 6 },
  todosBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.border },
  todosBtnTxt:   { fontSize: 11, fontWeight: '700' },
  colabRow:      { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar:        { alignItems: 'center', justifyContent: 'center', marginRight: 0 },
  avatarText:    { fontWeight: '800', letterSpacing: -0.3 },
  colabInfo:     { flex: 1, minWidth: 0 },
  colabNome:     { fontSize: 13, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  colabFuncao:   { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  colabToggles:  { flexDirection: 'row', gap: 8 },
  togBtn:        { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  togFood:       { backgroundColor: '#DCFCE7' },
  togCafe:       { backgroundColor: '#FEF3C7' },
  togInactive:   { backgroundColor: '#F1F5F9' },

  // ── Extras card ───────────────────────────────────────
  extrasCard:     { borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.35)', backgroundColor: '#FFFDF7' },
  extrasHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 8 },
  extrasLabel:    { fontSize: 11.5, fontWeight: '800', color: '#D97706', letterSpacing: 1, textTransform: 'uppercase' },
  extrasSub:      { fontSize: 11, fontWeight: '600', color: 'rgba(146,64,14,0.7)', marginTop: 3 },
  addExtraBtn:    { backgroundColor: '#D97706', borderRadius: 50, paddingHorizontal: 13, paddingVertical: 7 },
  addExtraTxt:    { fontSize: 11.5, fontWeight: '700', color: '#fff' },
  extraItem:      { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 14, padding: 11, marginBottom: 8 },
  extraItemRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  extraNomeInput: { flex: 1, minWidth: 0, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12.5, fontWeight: '600', color: '#334155' },
  extraBtns:      { flexDirection: 'row', gap: 6, alignItems: 'center' },
  extraTypeBtn:   { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  extraTypeBtnSel: { backgroundColor: '#7C3AED' },
  extraRemoveBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2' },
  extraJustInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, fontWeight: '500', color: '#475569' },

  // ── Observações ───────────────────────────────────────
  obsSection: { paddingHorizontal: 2, marginBottom: 8 },
  obsLabel:   { fontSize: 10.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  obsInput:   { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, padding: 14, minHeight: 58, fontSize: 12.5, color: '#334155' },

  // ── Modal ──────────────────────────────────────────────
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  modalTitle:      { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  modalItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4 },
  modalItemSel:    { backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.35)' },
  modalItemTxt:    { fontSize: 14, fontWeight: '600', color: '#334155' },
  modalItemTxtSel: { color: '#15803D', fontWeight: '700' },
  modalItemSub:    { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // ── Footer ────────────────────────────────────────────
  footer:        { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.09, shadowRadius: 16, elevation: 8 },
  kpiRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  kpi:           { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal:        { fontSize: 22, fontWeight: '900', lineHeight: 26, letterSpacing: -0.5 },
  kpiLabel:      { fontSize: 10, fontWeight: '500', color: '#94A3B8' },
  kpiSep:        { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  sendBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, backgroundColor: C.primary, borderRadius: 14, marginBottom: 8, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnTxt:    { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  footerNote:    { textAlign: 'center', fontSize: 11, color: '#94A3B8', fontWeight: '500' },
})
