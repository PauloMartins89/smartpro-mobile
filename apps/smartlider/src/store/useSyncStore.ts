// @ts-nocheck
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

export type SyncStatus = 'pending' | 'synced' | 'syncing' | 'error'

export interface PendingRecord {
  id: string
  table: string
  action: 'insert' | 'update'
  payload: Record<string, any>
  created_at: string
  attempts: number
}

interface SyncStore {
  queue: PendingRecord[]
  isSyncing: boolean
  lastSyncAt: string | null
  totalSynced: number
  addToQueue: (record: Omit<PendingRecord, 'attempts'>) => void
  removeFromQueue: (id: string) => void
  sync: () => Promise<{ ok: number; fail: number }>
  clearSynced: () => void
}

const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      lastSyncAt: null,
      totalSynced: 0,

      addToQueue: (record) => {
        set(s => ({
          queue: [...s.queue.filter(r => r.id !== record.id), { ...record, attempts: 0 }],
        }))
      },

      removeFromQueue: (id) => {
        set(s => ({ queue: s.queue.filter(r => r.id !== id) }))
      },

      sync: async () => {
        const { queue } = get()
        if (!queue.length) return { ok: 0, fail: 0 }
        set({ isSyncing: true })
        let ok = 0; let fail = 0

        for (const record of queue) {
          try {
            const { error } =
              record.action === 'insert'
                ? await supabase.from(record.table).insert(record.payload)
                : await supabase.from(record.table).update(record.payload).eq('id', record.payload.id)

            if (error) {
              fail++
              set(s => ({
                queue: s.queue.map(r =>
                  r.id === record.id ? { ...r, attempts: r.attempts + 1 } : r
                ),
              }))
            } else {
              ok++
              get().removeFromQueue(record.id)
            }
          } catch {
            fail++
          }
        }

        set(s => ({
          isSyncing: false,
          lastSyncAt: new Date().toISOString(),
          totalSynced: s.totalSynced + ok,
        }))
        return { ok, fail }
      },

      clearSynced: () => {
        set({ queue: [], totalSynced: 0 })
      },
    }),
    {
      name: 'smartlider-sync',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useSyncStore
