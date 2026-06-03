// @ts-nocheck
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

// Defaults: features já construídas = true; planejadas mas não buildadas = false
// O DB pode sobrescrever qualquer valor por workspace
export const FEATURE_DEFAULTS: Record<string, boolean> = {
  ocorrencias:          true,   // ✅ construído
  historico_turnos:     true,   // ✅ construído
  condicoes_climaticas: true,   // ✅ construído
  boletim_diario:       false,  // planejado
  notificacoes_push:    false,  // planejado
  checklist_seguranca:  false,  // planejado
  abastecimento:        false,  // planejado
  right_drawer:         false,  // planejado
  central_notificacoes: false,  // planejado
}

interface FeatureStore {
  features: Record<string, boolean>
  loadedWorkspaceId: string | null
  loadFeatures: (workspaceId: string) => Promise<void>
}

const useFeatureStore = create<FeatureStore>()(
  persist(
    (set, get) => ({
      features: { ...FEATURE_DEFAULTS },
      loadedWorkspaceId: null,

      loadFeatures: async (workspaceId: string) => {
        if (!workspaceId) return
        // Evita re-fetch desnecessário para o mesmo workspace
        if (get().loadedWorkspaceId === workspaceId) return

        const { data } = await supabase
          .from('lider_workspace_features')
          .select('feature, ativo')
          .eq('workspace_id', workspaceId)

        if (!data) return // mantém cache/defaults em caso de erro de rede

        // Começa dos defaults, aplica sobrescritas do DB
        const merged = { ...FEATURE_DEFAULTS }
        data.forEach(row => { merged[row.feature] = row.ativo })
        set({ features: merged, loadedWorkspaceId: workspaceId })
      },
    }),
    {
      name: 'smartlider-features',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useFeatureStore
