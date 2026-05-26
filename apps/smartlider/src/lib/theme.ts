// Tokens de design do SmartLíder
export const C = {
  // Backgrounds
  bg:         '#F8FAFC',
  bgCard:     '#FFFFFF',
  bgMuted:    '#F1F5F9',

  // Marca
  primary:    '#22C55E',  // verde SmartPro
  primaryDark:'#16A34A',
  navy:       '#0D1B2A',  // azul escuro header

  // Texto
  text:       '#0F172A',
  textSub:    '#64748B',
  textMuted:  '#94A3B8',

  // Bordas
  border:     '#E2E8F0',
  borderCard: '#F1F5F9',

  // Status
  green:      '#22C55E',
  greenBg:    '#DCFCE7',
  greenText:  '#15803D',
  yellow:     '#F59E0B',
  yellowBg:   '#FEF9C3',
  yellowText: '#A16207',
  red:        '#EF4444',
  redBg:      '#FEE2E2',
  redText:    '#B91C1C',
  blue:       '#3B82F6',
  blueBg:     '#DBEAFE',
  blueText:   '#1D4ED8',
  purple:     '#8B5CF6',
  purpleBg:   '#EDE9FE',
  purpleText: '#5B21B6',
  orange:     '#F97316',
  orangeBg:   '#FFEDD5',
  orangeText: '#C2410C',

  // Drawer (painel lateral)
  drawerBg:      '#0D1117',
  drawerCard:    '#161B22',
  drawerBorder:  '#30363D',
  drawerText:    '#F0F6FC',
  drawerTextSub: '#8B949E',
  drawerGreen:   '#3FB950',
  drawerYellow:  '#D29922',
  drawerRed:     '#F85149',
}

export const TURNO_LABEL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function calcEficiencia(realizado: number, meta: number) {
  if (!meta) return 0
  return Math.round((realizado / meta) * 100)
}

export function calcVolumeLha(vazao: number, velocidade: number, largura: number) {
  if (!velocidade || !largura) return 0
  return Math.round(((vazao * 60) / (velocidade * largura)) * 10) / 10
}
