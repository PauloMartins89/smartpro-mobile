// @ts-nocheck
/**
 * pedido-status.tsx
 * Tela de status do pedido de refeição após envio.
 * Três estados visuais: aguardando_aprovacao | aprovado | reprovado
 * Recebe params via Expo Router e assina realtime do Supabase.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl,
} from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { C, fmtDate } from '../../src/lib/theme'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtDateLong(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${Number(d)} de ${meses[Number(m)-1]}. de ${y}`
}
function fmtDateTime() {
  const now = new Date()
  return fmtDateLong(now.toISOString().slice(0,10)) + ' • ' +
    String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
}

// ── Configs por status ─────────────────────────────────────────────────────
const STATUS_CFG = {
  aguardando_aprovacao: {
    heroBg:        '#0C1D32',
    heroAccent:    '#F59E0B',
    iconName:      'time-outline',
    iconBg:        '#92400E22',
    iconBorder:    '#F59E0B',
    iconColor:     '#F59E0B',
    title:         'Pedido Enviado!',
    subtitle:      'Aguardando aprovação do supervisor.\nVocê será notificado assim que houver retorno.',
    badgeBg:       '#F59E0B22',
    badgeBorder:   '#F59E0B66',
    badgeColor:    '#F59E0B',
    badgeIcon:     'time-outline',
    badgeLabel:    'Aguardando aprovação',
  },
  aprovado: {
    heroBg:        '#071A0F',
    heroAccent:    '#22C55E',
    iconName:      'checkmark-outline',
    iconBg:        '#22C55E22',
    iconBorder:    '#22C55E',
    iconColor:     '#22C55E',
    title:         'Pedido Aprovado!',
    subtitle:      'Sua solicitação foi aprovada e já foi\nencaminhada ao restaurante.',
    badgeBg:       '#22C55E22',
    badgeBorder:   '#22C55E66',
    badgeColor:    '#4ADE80',
    badgeIcon:     'checkmark-circle-outline',
    badgeLabel:    'Aprovado pelo supervisor',
  },
  enviado_restaurante: {
    heroBg:        '#071A0F',
    heroAccent:    '#22C55E',
    iconName:      'storefront-outline',
    iconBg:        '#22C55E22',
    iconBorder:    '#22C55E',
    iconColor:     '#22C55E',
    title:         'Pedido Aprovado!',
    subtitle:      'Aprovado pelo supervisor e encaminhado\nao restaurante com sucesso.',
    badgeBg:       '#22C55E22',
    badgeBorder:   '#22C55E66',
    badgeColor:    '#4ADE80',
    badgeIcon:     'storefront-outline',
    badgeLabel:    'Enviado ao restaurante',
  },
  confirmado_restaurante: {
    heroBg:        '#071A0F',
    heroAccent:    '#22C55E',
    iconName:      'checkmark-done-outline',
    iconBg:        '#22C55E22',
    iconBorder:    '#22C55E',
    iconColor:     '#22C55E',
    title:         'Pedido Confirmado!',
    subtitle:      'O restaurante confirmou o recebimento\ndo pedido.',
    badgeBg:       '#22C55E22',
    badgeBorder:   '#22C55E66',
    badgeColor:    '#4ADE80',
    badgeIcon:     'checkmark-done-outline',
    badgeLabel:    'Confirmado pelo restaurante',
  },
  reprovado: {
    heroBg:        '#0C1D32',
    heroAccent:    '#EF4444',
    iconName:      'close-outline',
    iconBg:        '#EF444422',
    iconBorder:    '#EF4444',
    iconColor:     '#EF4444',
    title:         'Pedido Reprovado',
    subtitle:      'O supervisor reprovou sua solicitação.\nRevise e ajuste o pedido para reenviar.',
    badgeBg:       '#EF444422',
    badgeBorder:   '#EF444466',
    badgeColor:    '#FCA5A5',
    badgeIcon:     'close-circle-outline',
    badgeLabel:    'Reprovado pelo supervisor',
  },
}

// ── Step do stepper ────────────────────────────────────────────────────────
function Step({ state, label, sub, isLast }: {
  state: 'done' | 'active' | 'pending' | 'rejected'
  label: string
  sub?: string
  isLast?: boolean
}) {
  const nodeColors = {
    done:     { bg: C.primary,   border: C.primary,   icon: 'checkmark', color: '#fff' },
    active:   { bg: '#FEF3C7',   border: '#F59E0B',   icon: 'time-outline', color: '#F59E0B' },
    pending:  { bg: C.bgMuted,   border: C.border,    icon: null, color: C.textMuted },
    rejected: { bg: '#FEE2E2',   border: '#EF4444',   icon: 'close', color: '#EF4444' },
  }
  const labelColors = {
    done:     C.greenText,
    active:   '#B45309',
    pending:  C.textMuted,
    rejected: '#DC2626',
  }
  const nc = nodeColors[state]

  return (
    <View style={ss.stepWrap}>
      <View style={ss.stepTop}>
        <View style={[ss.stepNode, { backgroundColor: nc.bg, borderColor: nc.border }]}>
          {nc.icon
            ? <Ionicons name={nc.icon} size={16} color={nc.color} />
            : <Text style={[ss.stepNum, { color: nc.color }]}>—</Text>
          }
        </View>
        {!isLast && (
          <View style={[
            ss.stepLine,
            (state === 'done') && { backgroundColor: C.primary },
            (state === 'rejected') && { backgroundColor: '#EF4444' },
            (state === 'active' || state === 'pending') && { backgroundColor: C.border },
          ]} />
        )}
      </View>
      <Text style={[ss.stepLabel, { color: labelColors[state] }]}>{label}</Text>
      {sub ? <Text style={ss.stepSub}>{sub}</Text> : null}
    </View>
  )
}

// ── Linha do Resumo ────────────────────────────────────────────────────────
function ResumoRow({ icon, label, value, valueStyle }: any) {
  return (
    <View style={ss.resumoRow}>
      <View style={ss.resumoIcon}>
        <Ionicons name={icon} size={15} color={C.primary} />
      </View>
      <Text style={ss.resumoLabel}>{label}</Text>
      <Text style={[ss.resumoValue, valueStyle]}>{value}</Text>
    </View>
  )
}

// ── Tela principal ─────────────────────────────────────────────────────────
export default function PedidoStatusScreen() {
  const router     = useRouter()
  const nav        = useNavigation()
  const params     = useLocalSearchParams<{
    id:          string
    numero:      string
    equipe:      string
    restaurante: string
    qtdRef:      string
    qtdCafe:     string
    total:       string
    data:        string
  }>()

  const [status,          setStatus]   = useState('aguardando_aprovacao')
  const [motivoReprov,    setMotivo]   = useState<string|null>(null)
  const [aprovadoPor,     setAprovPor] = useState<string|null>(null)
  const [aprovadoMsg,     setAprovMsg] = useState<string|null>(null)
  const [loading,         setLoading]  = useState(true)
  const [refreshing,      setRefresh]  = useState(false)
  const [timestamp,       setTs]       = useState(fmtDateTime())

  const cfg = STATUS_CFG[status] || STATUS_CFG['aguardando_aprovacao']

  // ── Ajusta o header ──────────────────────────────────────────────────────
  useEffect(() => {
    nav.setOptions({ title: 'Status do Pedido' })
  }, [])

  // ── Fetch inicial + realtime ──────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!params.id) return
    const { data } = await supabase
      .from('refei_solicitacoes')
      .select('status, motivo_reprovacao')
      .eq('id', params.id)
      .single()

    if (data) {
      setStatus(data.status || 'aguardando_aprovacao')
      setMotivo(data.motivo_reprovacao || null)
      setAprovPor(null)
      setAprovMsg(null)
    }
    setLoading(false)
    setRefresh(false)
  }, [params.id])

  useEffect(() => {
    fetchStatus()

    // Realtime: assina mudanças na linha do pedido
    if (!params.id) return
    const channel = supabase
      .channel('pedido-status-' + params.id)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'refei_solicitacoes',
        filter: `id=eq.${params.id}`,
      }, (payload) => {
        const row = payload.new
        setStatus(row.status || 'aguardando_aprovacao')
        setMotivo(row.motivo_reprovacao || null)
        setAprovPor(null)
        setAprovMsg(null)
        setTs(fmtDateTime())
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [params.id])

  const onRefresh = useCallback(() => {
    setRefresh(true)
    fetchStatus()
  }, [fetchStatus])

  // ── Stepper config por status ────────────────────────────────────────────
  function renderStepper() {
    if (status === 'aprovado') {
      return (
        <View style={ss.stepperRow}>
          <Step state="done"    label="Enviado"      sub="Você" />
          <Step state="done"    label="Aprovado"     sub="Supervisor" />
          <Step state="active"  label="Restaurante"  sub="Aguardando" isLast />
        </View>
      )
    }
    if (status === 'enviado_restaurante') {
      return (
        <View style={ss.stepperRow}>
          <Step state="done"    label="Enviado"      sub="Você" />
          <Step state="done"    label="Aprovado"     sub="Supervisor" />
          <Step state="done"    label="Restaurante"  sub="Notificado" isLast />
        </View>
      )
    }
    if (status === 'confirmado_restaurante') {
      return (
        <View style={ss.stepperRow}>
          <Step state="done"    label="Enviado"      sub="Você" />
          <Step state="done"    label="Aprovado"     sub="Supervisor" />
          <Step state="done"    label="Confirmado"   sub="Restaurante" isLast />
        </View>
      )
    }
    if (status === 'reprovado') {
      return (
        <View style={ss.stepperRow}>
          <Step state="done"     label="Enviado"    sub="Você" />
          <Step state="done"     label="Em análise" sub="Sistema" />
          <Step state="rejected" label="Reprovado"  sub="Supervisor" isLast />
        </View>
      )
    }
    // aguardando_aprovacao (e outros estados intermediários)
    return (
      <View style={ss.stepperRow}>
        <Step state="done"    label="Criado"     sub="Você" />
        <Step state="active"  label="Aguardando" sub="Supervisor" />
        <Step state="pending" label="Restaurante" isLast />
      </View>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={ss.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={ss.root}>
      <ScrollView
        contentContainerStyle={ss.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <View style={[ss.hero, { backgroundColor: cfg.heroBg }]}>

          {/* Ícone central */}
          <View style={[ss.iconRing, { borderColor: cfg.heroAccent + '33' }]}>
            <View style={[ss.iconCircle, { backgroundColor: cfg.iconBg, borderColor: cfg.iconBorder }]}>
              <Ionicons name={cfg.iconName} size={40} color={cfg.iconColor} />
            </View>
          </View>

          {/* Título */}
          <Text style={ss.heroTitle}>{cfg.title}</Text>
          <Text style={ss.heroSub}>{cfg.subtitle}</Text>

          {/* Badge de status */}
          <View style={[ss.badge, { backgroundColor: cfg.badgeBg, borderColor: cfg.badgeBorder }]}>
            <Ionicons name={cfg.badgeIcon} size={14} color={cfg.badgeColor} />
            <Text style={[ss.badgeText, { color: cfg.badgeColor }]}>{cfg.badgeLabel}</Text>
          </View>

          {/* Número do pedido em destaque */}
          <View style={ss.numeroBadge}>
            <Ionicons name="receipt-outline" size={13} color={C.textMuted} />
            <Text style={ss.numeroText}>{params.numero || '—'}</Text>
          </View>
        </View>

        {/* ── BODY ─────────────────────────────────────────────────────── */}
        <View style={ss.body}>

          {/* Resumo do Pedido */}
          <View style={ss.card}>
            <View style={ss.cardHeader}>
              <View style={ss.cardIcon}>
                <Ionicons name="list-outline" size={17} color={C.primary} />
              </View>
              <Text style={ss.cardTitle}>RESUMO DO PEDIDO</Text>
            </View>

            <ResumoRow
              icon="document-text-outline"
              label="Pedido"
              value={params.numero || '—'}
              valueStyle={ss.valueRef}
            />
            <ResumoRow
              icon="people-outline"
              label="Equipe"
              value={params.equipe || '—'}
            />
            <ResumoRow
              icon="storefront-outline"
              label="Restaurante"
              value={params.restaurante || '—'}
            />
            <ResumoRow
              icon="restaurant-outline"
              label="Refeições / Cafés"
              value={`${params.qtdRef || 0} ref  ·  ${params.qtdCafe || 0} cafés`}
            />
            <ResumoRow
              icon="wallet-outline"
              label="Total estimado"
              value={fmtBRL(params.total)}
              valueStyle={ss.valueTotal}
            />

            {/* Data/hora */}
            <View style={ss.dateRow}>
              <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
              <Text style={ss.dateText}>
                {fmtDateLong(params.data)} • atualizado {timestamp}
              </Text>
            </View>
          </View>

          {/* Aprovação do Supervisor */}
          {(status === 'aprovado' || status === 'enviado_restaurante' || status === 'confirmado_restaurante') && (
            <View style={ss.card}>
              <View style={ss.cardHeader}>
                <View style={[ss.cardIcon, { backgroundColor: C.greenBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={17} color={C.primary} />
                </View>
                <Text style={ss.cardTitle}>APROVAÇÃO DO SUPERVISOR</Text>
              </View>
              <View style={ss.infoBox}>
                <View style={[ss.infoBoxIcon, { backgroundColor: C.greenBg }]}>
                  <Ionicons name="person-circle-outline" size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ss.infoBoxWho, { color: C.greenText }]}>
                    {aprovadoPor || 'Supervisor'}
                  </Text>
                  <Text style={ss.infoBoxMsg}>
                    {aprovadoMsg || 'Pedido aprovado. Encaminhado ao restaurante.'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Justificativa do Supervisor (reprovado) */}
          {status === 'reprovado' && motivoReprov && (
            <View style={ss.card}>
              <View style={ss.cardHeader}>
                <View style={[ss.cardIcon, { backgroundColor: C.redBg }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={C.red} />
                </View>
                <Text style={[ss.cardTitle, { color: C.red }]}>JUSTIFICATIVA DO SUPERVISOR</Text>
              </View>
              <View style={[ss.infoBox, { backgroundColor: C.redBg, borderColor: C.red + '33' }]}>
                <View style={[ss.infoBoxIcon, { backgroundColor: C.redBg }]}>
                  <Ionicons name="alert-circle-outline" size={20} color={C.red} />
                </View>
                <View style={{ flex: 1 }}>
                  {aprovadoPor ? (
                    <Text style={[ss.infoBoxWho, { color: C.red }]}>{aprovadoPor}</Text>
                  ) : null}
                  <Text style={[ss.infoBoxMsg, { color: '#7F1D1D' }]}>{motivoReprov}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Próximas Etapas / Histórico */}
          <View style={ss.card}>
            <View style={ss.cardHeader}>
              <View style={[ss.cardIcon, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="flag-outline" size={17} color="#F59E0B" />
              </View>
              <Text style={ss.cardTitle}>
                {status === 'reprovado' ? 'HISTÓRICO DO PEDIDO' : 'PRÓXIMAS ETAPAS'}
              </Text>
            </View>
            {renderStepper()}
          </View>

          {/* Pull to refresh hint */}
          {status === 'aguardando_aprovacao' && (
            <View style={ss.hintRow}>
              <Ionicons name="refresh-outline" size={13} color={C.textMuted} />
              <Text style={ss.hintText}>
                Puxe para baixo para atualizar o status
              </Text>
            </View>
          )}

        </View>{/* /body */}
      </ScrollView>

      {/* ── FOOTER FIXO ──────────────────────────────────────────────────── */}
      <View style={ss.footer}>

        {/* Botão primário: varia por status */}
        {status === 'reprovado' ? (
          <TouchableOpacity
            style={[ss.btnPrimary, { backgroundColor: C.red, shadowColor: C.red }]}
            onPress={() => router.replace('/solicitacao/refeicao')}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={ss.btnText}>Ajustar e Reenviar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={ss.btnPrimary}
            onPress={() => router.push('/solicitacao/refeicao-historico')}
            activeOpacity={0.85}
          >
            <Ionicons name="bar-chart-outline" size={18} color="#fff" />
            <Text style={ss.btnText}>Acompanhar Pedido</Text>
          </TouchableOpacity>
        )}

        {/* Botão secundário */}
        <TouchableOpacity
          style={ss.btnOutline}
          onPress={() => router.replace('/(tabs)/')}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={18} color={C.primary} />
          <Text style={ss.btnOutlineText}>Voltar ao Início</Text>
        </TouchableOpacity>

        {/* Nota de rodapé */}
        <View style={ss.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={12} color={C.textMuted} />
          <Text style={ss.footerNoteText}>
            {status === 'reprovado'
              ? 'Você pode corrigir a solicitação e reenviar para nova aprovação.'
              : (status === 'aprovado' || status === 'enviado_restaurante' || status === 'confirmado_restaurante')
              ? 'Pedido confirmado e encaminhado ao restaurante.'
              : 'Você será avisado quando o supervisor aprovar.'}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ── Estilos ────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingBottom: 160 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 32,
  },
  iconRing: {
    width: 100, height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 82, height: 82,
    borderRadius: 41,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    letterSpacing: -0.5, textAlign: 'center', marginBottom: 8,
  },
  heroSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 20, marginBottom: 18,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 50, borderWidth: 1.5, marginBottom: 14,
  },
  badgeText:   { fontSize: 12.5, fontWeight: '800' },
  numeroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  numeroText:  { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },

  // Body
  body: { padding: 16, gap: 14 },

  // Card
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.greenBg,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: C.text, letterSpacing: 1 },

  // Resumo rows
  resumoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.bgMuted },
  resumoIcon:  { width: 30, height: 30, borderRadius: 8, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
  resumoLabel: { flex: 1, fontSize: 12.5, color: C.textSub, fontWeight: '500' },
  resumoValue: { fontSize: 13, fontWeight: '700', color: C.text },
  valueRef:    { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  valueTotal:  { fontSize: 15, fontWeight: '900', color: C.primary },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.bgMuted },
  dateText:    { fontSize: 11, color: C.textMuted },

  // Info box (aprovado/reprovado)
  infoBox: {
    flexDirection: 'row', gap: 12,
    backgroundColor: C.bgMuted,
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: C.border,
  },
  infoBoxIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoBoxWho:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  infoBoxMsg:  { fontSize: 12.5, color: C.textSub, lineHeight: 18, fontWeight: '500' },

  // Stepper
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepWrap:   { flex: 1, alignItems: 'center' },
  stepTop:    { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stepNode: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  stepLine:   { flex: 1, height: 2, marginTop: 0, backgroundColor: C.border },
  stepNum:    { fontSize: 12, fontWeight: '800' },
  stepLabel:  { fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 6, lineHeight: 14 },
  stepSub:    { fontSize: 9.5, color: C.textMuted, textAlign: 'center', marginTop: 2 },

  // Hint
  hintRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 4 },
  hintText: { fontSize: 11, color: C.textMuted },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bgCard,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 14,
    gap: 10,
  },
  btnPrimary: {
    height: 50, borderRadius: 14,
    backgroundColor: C.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnText:         { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnOutline: {
    height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.primary, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  btnOutlineText:  { color: C.primary, fontSize: 14, fontWeight: '700' },
  footerNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  footerNoteText: { fontSize: 10.5, color: C.textMuted, textAlign: 'center', flex: 1 },
})
