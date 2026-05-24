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

interface LiderStore {
  turnoAtivo:  TurnoAtivo | null
  workspaceId: string
  dashRefreshKey: number
  setTurnoAtivo:      (turno: TurnoAtivo | null) => void
  setWorkspaceId:     (id: string) => void
  triggerDashRefresh: () => void
}

const useLiderStore = create<LiderStore>()(
  persist(
    set => ({
      turnoAtivo:  null,
      workspaceId: '',
      dashRefreshKey: 0,
      setTurnoAtivo:      turno => set({ turnoAtivo: turno }),
      setWorkspaceId:     id    => set({ workspaceId: id }),
      triggerDashRefresh: ()    => set(s => ({ dashRefreshKey: s.dashRefreshKey + 1 })),
    }),
    {
      name:    'smartlider-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        turnoAtivo:  state.turnoAtivo,
        workspaceId: state.workspaceId,
      }),
    }
  )
)

export default useLiderStore
