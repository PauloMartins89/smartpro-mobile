// Supabase client
export { supabase } from './supabase'
export type { Session, User } from './supabase'

// Types compartilhados
export type BoletimStatus =
  | 'aguardando'
  | 'processando'
  | 'processado'
  | 'pendente_revisao'
  | 'nao_encontrado'

export interface Boletim {
  id: string
  created_at: string
  updated_at?: string
  status: BoletimStatus
  imagem_url: string
  user_id: string
  workspace_id?: string
  dados_extras: Record<string, unknown>
}

export interface BoletimCampo {
  id: string
  boletim_id: string
  campo: string
  valor_ocr: string
  valor_matched?: string
  confianca: number
  status: 'ok' | 'pendente_revisao' | 'nao_encontrado'
}

export const STATUS_COLORS: Record<string, string> = {
  processado: '#22C55E',
  pendente_revisao: '#F59E0B',
  nao_encontrado: '#EF4444',
  aguardando: '#6366F1',
  processando: '#3B82F6',
}

export const STATUS_LABELS: Record<string, string> = {
  processado: 'Processado',
  pendente_revisao: 'Revisar',
  nao_encontrado: 'Não encontrado',
  aguardando: 'Aguardando',
  processando: 'Processando',
}
