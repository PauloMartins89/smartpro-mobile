// Cache offline para listas de lookup (colaboradores, maquinas, EPIs, produtos)
// Persiste em AsyncStorage para funcionar sem rede
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface LookupCacheStore {
  data: Record<string, any[]>
  set: (key: string, items: any[]) => void
  get: (key: string) => any[]
}

const useLookupCache = create<LookupCacheStore>()(
  persist(
    (set, get) => ({
      data: {},
      set: (key, items) => set(s => ({ data: { ...s.data, [key]: items } })),
      get: (key) => get().data[key] ?? [],
    }),
    {
      name: 'smartlider-lookup-cache',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useLookupCache
