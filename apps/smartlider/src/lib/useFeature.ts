import useFeatureStore, { FEATURE_DEFAULTS } from '../store/useFeatureStore'

/** Retorna true se a feature está habilitada para o workspace atual.
 *  Fallback para FEATURE_DEFAULTS se ainda não carregado do DB. */
export function useFeature(key: string): boolean {
  return useFeatureStore(s => s.features[key] ?? FEATURE_DEFAULTS[key] ?? false)
}
