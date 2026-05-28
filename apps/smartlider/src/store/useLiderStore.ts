import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Turno = 'manha' | 'tarde' | 'noite'

export interface LiderPerfil {
  id:             string   // lider_perfis.id
  matricula:      string
  nome:           string
  workspace_id:   string
  equipe_id:      string | null
  equipe_nome:    string | null
  equipe_codigo:  string | null
  frente_id:      string | null
  frente_nome:    string | null
  frente_codigo:  string | null
}

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
  turnoAtivo:     TurnoAtivo | null
  liderPerfil:    LiderPerfil | null
  workspaceId:    string
  dashRefreshKey: number
  turnoStats:     TurnoStats | null
  _hasHydrated:   boolean
  setTurnoAtivo:      (turno: TurnoAtivo | null) => void
  setLiderPerfil:     (perfil: LiderPerfil | null) => void
  setWorkspaceId:     (id: string) => void
  triggerDashRefresh: () => void
  setTurnoStats:      (stats: TurnoStats) => void
  setHasHydrated:     (v: boolean) => void
}

const useLiderStore = create<LiderStore>()(
  persist(
    set => ({
      turnoAtivo:  null,
      liderPerfil: null,
      workspaceId: '',
      dashRefreshKey: 0,
      turnoStats:  null,
      _hasHydrated: false,
      setTurnoAtivo:      turno  => set({ turnoAtivo: turno }),
      setLiderPerfil:     perfil => set({ liderPerfil: perfil, workspaceId: perfil?.workspace_id ?? '' }),
      setWorkspaceId:     id     => set({ workspaceId: id }),
      triggerDashRefresh: ()     => set(s => ({ dashRefreshKey: s.dashRefreshKey + 1 })),
      setTurnoStats:      stats  => set({ turnoStats: stats }),
      setHasHydrated:     v      => set({ _hasHydrated: v }),
    }),
    {
      name:    'smartlider-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        turnoAtivo:  state.turnoAtivo,
        liderPerfil: state.liderPerfil,
        workspaceId: state.workspaceId,
        turnoStats:  state.turnoStats,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export default useLiderStore
