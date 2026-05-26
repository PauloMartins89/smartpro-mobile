import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Turno = 'manha' | 'tarde' | 'noite'

export interface TurnoAtivo {
  id:          string
  frente_id:   string
  frente_nome: string
  equipe_id:   string
  equipe_nome: string
  lider_nome:  string
  data:        string  // YYYY-MM-DD
  turno:       Turno
  status:      'aberto' | 'fechado'
}

export interface TurnoStats {
  presentes:            number
  total_colaboradores:  number
  maquinas:             number
  ha_realizado:         number
  ha_meta:              number
  refeicoes:            number
  epis_pendentes:       number
  solicitacoes:         number
  afericoes_reprovadas: number
  epis_vencendo:        number
  avaliacao_media:      number
  insumos_divergentes:  number
  updatedAt:            string | null
}

interface LiderStore {
  turnoAtivo:    TurnoAtivo | null
  workspaceId:   string
  dashRefreshKey: number
  turnoStats:    TurnoStats | null
  setTurnoAtivo:      (turno: TurnoAtivo | null) => void
  setWorkspaceId:     (id: string) => void
  triggerDashRefresh: () => void
  setTurnoStats:      (stats: TurnoStats) => void
}

const useLiderStore = create<LiderStore>()(
  persist(
    set => ({
      turnoAtivo:  null,
      workspaceId: '',
      dashRefreshKey: 0,
      turnoStats:  null,
      setTurnoAtivo:      turno => set({ turnoAtivo: turno }),
      setWorkspaceId:     id    => set({ workspaceId: id }),
      triggerDashRefresh: ()    => set(s => ({ dashRefreshKey: s.dashRefreshKey + 1 })),
      setTurnoStats:      stats => set({ turnoStats: stats }),
    }),
    {
      name:    'smartlider-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        turnoAtivo:  state.turnoAtivo,
        workspaceId: state.workspaceId,
        turnoStats:  state.turnoStats,
      }),
    }
  )
)

export default useLiderStore
