// @ts-nocheck
/**
 * Componentes visuais compartilhados pelos módulos operacionais do SmartLider.
 * StatCard, StatusChip, SyncBanner, PageHeader, Section, RecordList.
 */
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { C } from '../lib/theme'
import useSyncStore from '../store/useSyncStore'

// ── StatCard ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  icon: string
  color?: string
  bg?: string
  sub?: string
}
export function StatCard({ label, value, icon, color = C.primary, bg = C.greenBg, sub }: StatCardProps) {
  return (
    <View style={[sc.card, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={[sc.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label} numberOfLines={2}>{label}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  )
}
const sc = StyleSheet.create({
  card:     { flex: 1, minWidth: 120, backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginRight: 10, borderWidth: 1, borderColor: C.border },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  value:    { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 2 },
  label:    { fontSize: 11, fontWeight: '600', color: C.textSub },
  sub:      { fontSize: 10, color: C.textMuted, marginTop: 2 },
})

// ── StatusChip ──────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  // sync
  synced:    { label: 'Sincronizado', color: C.greenText,  bg: C.greenBg  },
  pending:   { label: 'Pendente',     color: C.yellowText, bg: C.yellowBg },
  syncing:   { label: 'Sincronizando',color: C.blueText,   bg: C.blueBg   },
  error:     { label: 'Erro',         color: C.redText,    bg: C.redBg    },
  // operacional
  rascunho:  { label: 'Rascunho',     color: C.textSub,    bg: C.bgMuted  },
  enviado:   { label: 'Enviado',      color: C.blueText,   bg: C.blueBg   },
  validado:  { label: 'Validado',     color: C.greenText,  bg: C.greenBg  },
  divergente:{ label: 'Divergente',   color: C.redText,    bg: C.redBg    },
  apontado:  { label: 'Apontado',     color: C.blueText,   bg: C.blueBg   },
  inconsistente: { label: 'Inconsistente', color: C.redText, bg: C.redBg  },
  parado:    { label: 'Parado',       color: C.redText,    bg: C.redBg    },
  parada:    { label: 'Parada',       color: C.redText,    bg: C.redBg    },
  operando:  { label: 'Operando',     color: C.greenText,  bg: C.greenBg  },
  manutencao:{ label: 'Manutencao',   color: C.yellowText, bg: C.yellowBg },
  aprovado:  { label: 'Aprovado',     color: C.greenText,  bg: C.greenBg  },
  reprovado: { label: 'Reprovado',    color: C.redText,    bg: C.redBg    },
  aguardando:{ label: 'Aguardando',   color: C.yellowText, bg: C.yellowBg },
  'ajuste_necessario': { label: 'Ajuste', color: C.yellowText, bg: C.yellowBg },
  // produtividade
  acima_meta:  { label: 'Acima da Meta',   color: C.greenText,  bg: C.greenBg  },
  dentro_meta: { label: 'Dentro da Meta',  color: C.blueText,   bg: C.blueBg   },
  abaixo_meta: { label: 'Abaixo da Meta',  color: C.yellowText, bg: C.yellowBg },
  // epi
  entregue:      { label: 'Entregue',      color: C.greenText,  bg: C.greenBg  },
  vencendo:      { label: 'Vencendo',      color: C.yellowText, bg: C.yellowBg },
  vencido:       { label: 'Vencido',       color: C.redText,    bg: C.redBg    },
  substituicao:  { label: 'Substituição',  color: C.redText,    bg: C.redBg    },
  // solicitações
  solicitado:    { label: 'Solicitado',    color: C.blueText,   bg: C.blueBg   },
  aguardando:    { label: 'Aguardando',    color: C.yellowText, bg: C.yellowBg },
  separado:      { label: 'Separado',      color: C.blueText,   bg: C.blueBg   },
  cancelado:     { label: 'Cancelado',     color: C.textSub,    bg: C.bgMuted  },
  recusado:      { label: 'Recusado',      color: C.redText,    bg: C.redBg    },
  pendente:      { label: 'Pendente',      color: C.yellowText, bg: C.yellowBg },
  // avaliação
  avaliado:  { label: 'Avaliado',  color: C.greenText, bg: C.greenBg },
  revisado:  { label: 'Revisado',  color: C.blueText,  bg: C.blueBg  },
}

export function StatusChip({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_MAP[status] ?? { label: status, color: C.textSub, bg: C.bgMuted }
  return (
    <View style={[chip.wrap, { backgroundColor: cfg.bg }, size === 'sm' && chip.sm]}>
      <Text style={[chip.text, { color: cfg.color }, size === 'sm' && chip.smText]}>{cfg.label}</Text>
    </View>
  )
}
const chip = StyleSheet.create({
  wrap:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text:   { fontSize: 11, fontWeight: '700' },
  sm:     { paddingHorizontal: 8, paddingVertical: 2 },
  smText: { fontSize: 10 },
})

// ── SyncBanner ──────────────────────────────────────────────────────────────
export function SyncBanner() {
  const queue     = useSyncStore(s => s.queue)
  const isSyncing = useSyncStore(s => s.isSyncing)
  const sync      = useSyncStore(s => s.sync)
  const lastSync  = useSyncStore(s => s.lastSyncAt)

  if (!queue.length && !isSyncing) return null

  return (
    <View style={sb.wrap}>
      <View style={sb.left}>
        <Ionicons name={isSyncing ? 'sync-outline' : 'cloud-upload-outline'} size={15} color={C.yellowText} />
        <Text style={sb.text}>
          {isSyncing ? 'Sincronizando...' : `${queue.length} registro${queue.length > 1 ? 's' : ''} pendente${queue.length > 1 ? 's' : ''}`}
        </Text>
      </View>
      {!isSyncing && (
        <TouchableOpacity style={sb.btn} onPress={() => sync()} activeOpacity={0.8}>
          <Text style={sb.btnText}>Sincronizar</Text>
        </TouchableOpacity>
      )}
      {isSyncing && <ActivityIndicator size="small" color={C.yellowText} />}
    </View>
  )
}
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.yellowBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginBottom: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  text: { fontSize: 12, fontWeight: '600', color: C.yellowText },
  btn:  { backgroundColor: C.yellow, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
})

// ── SyncStatusDot ────────────────────────────────────────────────────────────
export function SyncStatusDot({ status }: { status: 'pending' | 'synced' | 'error' }) {
  const color = status === 'synced' ? C.green : status === 'error' ? C.red : C.yellow
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
}

// ── Section label ────────────────────────────────────────────────────────────
export function Section({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  )
}

// ── EmptyList ────────────────────────────────────────────────────────────────
export function EmptyList({ icon = 'document-text-outline', msg = 'Nenhum registro encontrado' }: { icon?: string; msg?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Ionicons name={icon as any} size={40} color={C.textMuted} />
      <Text style={{ color: C.textSub, fontSize: 14, marginTop: 12 }}>{msg}</Text>
    </View>
  )
}
