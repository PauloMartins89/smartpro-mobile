// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useNavigation } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../../src/lib/supabase'
import useLiderStore from '../../src/store/useLiderStore'
import { C } from '../../src/lib/theme'

const TIPO_LABEL = { acesso: 'Acesso', microplanejamento: 'Microplanejamento', outro: 'Outro' }
const TIPO_COLOR = { acesso: C.primary, microplanejamento: '#e67e22', outro: C.textMuted }
const TIPO_ICON  = { acesso: 'navigate-outline', microplanejamento: 'map-outline', outro: 'document-outline' }

const LOCAL_DIR  = FileSystem.cacheDirectory + 'mapas/'
const localPath  = (id) => LOCAL_DIR + id + '.png'

function fmtBytes(b) {
  if (!b) return null
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

export default function MapaListScreen() {
  const nav         = useNavigation()
  const router      = useRouter()
  const workspaceId = useLiderStore(s => s.workspaceId)

  const [mapas,      setMapas]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dlStatus,   setDlStatus]   = useState({})   // { [id]: 'idle'|'downloading'|'done' }
  const [dlProgress, setDlProgress] = useState({})   // { [id]: 0â€“1 }
  const dlRef = useRef({})

  useEffect(() => { nav.setOptions({ title: 'Mapas' }) }, [])

  const carregar = useCallback(async (isRefresh = false) => {
    if (!workspaceId) return
    isRefresh ? setRefreshing(true) : setLoading(true)

    const { data } = await supabase
      .from('lider_mapas')
      .select('id, nome, descricao, tipo, imagem_url, tamanho_bytes, pdf_origem, criado_em')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .order('criado_em', { ascending: false })

    const lista = data ?? []
    setMapas(lista)

    // Verifica quais mapas jÃ¡ estÃ£o em cache local
    const status = { ...dlStatus }
    await Promise.all(lista.map(async m => {
      if (status[m.id] === 'downloading') return   // nÃ£o sobrescreve download ativo
      const info = await FileSystem.getInfoAsync(localPath(m.id))
      status[m.id] = info.exists ? 'done' : 'idle'
    }))
    setDlStatus(status)

    isRefresh ? setRefreshing(false) : setLoading(false)
  }, [workspaceId])

  useEffect(() => { carregar() }, [carregar])

  // â”€â”€ Download individual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const baixar = useCallback(async (m) => {
    if (!m.imagem_url || dlRef.current[m.id]) return
    try {
      await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true })
      setDlStatus(s => ({ ...s, [m.id]: 'downloading' }))
      setDlProgress(p => ({ ...p, [m.id]: 0 }))

      const task = FileSystem.createDownloadResumable(
        m.imagem_url,
        localPath(m.id),
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          const prog = totalBytesExpectedToWrite > 0
            ? totalBytesWritten / totalBytesExpectedToWrite
            : 0
          setDlProgress(p => ({ ...p, [m.id]: prog }))
        }
      )
      dlRef.current[m.id] = task
      const result = await task.downloadAsync()
      if (result?.status === 200) {
        setDlStatus(s => ({ ...s, [m.id]: 'done' }))
      } else {
        throw new Error(`Status ${result?.status}`)
      }
    } catch (e) {
      setDlStatus(s => ({ ...s, [m.id]: 'idle' }))
      Alert.alert('Erro no download', e.message)
    } finally {
      delete dlRef.current[m.id]
    }
  }, [])

  // â”€â”€ Remover cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const removerCache = useCallback((m) => {
    Alert.alert(
      'Remover download?',
      `"${m.nome}" serÃ¡ removido do armazenamento offline.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive', onPress: async () => {
            await FileSystem.deleteAsync(localPath(m.id), { idempotent: true })
            setDlStatus(s => ({ ...s, [m.id]: 'idle' }))
          }
        },
      ]
    )
  }, [])

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) return (
    <View style={st.center}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  )

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={C.primary} />}>

      {mapas.length === 0 ? (
        <View style={st.empty}>
          <Ionicons name="map-outline" size={48} color={C.textMuted} />
          <Text style={st.emptyTitle}>Nenhum mapa disponÃ­vel</Text>
          <Text style={st.emptySub}>
            Importe mapas GeoPDF pelo script{'\n'}
            scripts/geopdf_to_supabase.py
          </Text>
        </View>
      ) : (
        mapas.map(m => {
          const st_dl  = dlStatus[m.id] ?? 'idle'
          const prog   = dlProgress[m.id] ?? 0
          const cor    = TIPO_COLOR[m.tipo] ?? C.primary

          return (
            <View key={m.id} style={st.card}>
              {/* Ãrea clicÃ¡vel â†’ abre mapa */}
              <TouchableOpacity
                style={st.cardTouchable}
                onPress={() => router.push(`/mapa/${m.id}`)}
                activeOpacity={0.82}>

                <View style={[st.iconWrap, { backgroundColor: cor + '22' }]}>
                  <Ionicons name={TIPO_ICON[m.tipo] ?? 'map-outline'} size={24} color={cor} />
                </View>

                <View style={st.cardBody}>
                  <View style={st.cardTitleRow}>
                    <Text style={st.cardTitle} numberOfLines={1}>{m.nome}</Text>
                    {st_dl === 'done' && (
                      <View style={st.offlinePill}>
                        <Ionicons name="cloud-done-outline" size={11} color="#4ade80" />
                        <Text style={st.offlineTxt}>Offline</Text>
                      </View>
                    )}
                  </View>
                  {!!m.descricao && <Text style={st.cardSub} numberOfLines={1}>{m.descricao}</Text>}
                  <View style={st.cardMeta}>
                    <View style={[st.badge, { backgroundColor: cor + '20' }]}>
                      <Text style={[st.badgeTxt, { color: cor }]}>
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </Text>
                    </View>
                    {!!m.tamanho_bytes && <Text style={st.metaTxt}>{fmtBytes(m.tamanho_bytes)}</Text>}
                    {!!m.pdf_origem && (
                      <Text style={st.metaTxt} numberOfLines={1}>{m.pdf_origem}</Text>
                    )}
                  </View>

                  {/* Barra de progresso durante download */}
                  {st_dl === 'downloading' && (
                    <View style={st.progWrap}>
                      <View style={[st.progBar, { width: `${Math.round(prog * 100)}%` }]} />
                      <Text style={st.progTxt}>{Math.round(prog * 100)}%</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* BotÃ£o de download / remover (nÃ£o propaga o tap para o card) */}
              <TouchableOpacity
                style={st.dlBtn}
                onPress={() => st_dl === 'done' ? removerCache(m) : baixar(m)}
                disabled={st_dl === 'downloading'}
                hitSlop={8}>
                {st_dl === 'downloading'
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <Ionicons
                      name={st_dl === 'done' ? 'trash-outline' : 'cloud-download-outline'}
                      size={20}
                      color={st_dl === 'done' ? '#ef4444' : C.textMuted}
                    />
                }
              </TouchableOpacity>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:         { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: C.text },
  emptySub:      { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
                   borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border,
                   overflow: 'hidden' },
  cardTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  iconWrap:      { width: 48, height: 48, borderRadius: 12, justifyContent: 'center',
                   alignItems: 'center', marginRight: 14, flexShrink: 0 },
  cardBody:      { flex: 1, gap: 4 },
  cardTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  cardSub:       { fontSize: 13, color: C.textMuted },
  cardMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeTxt:      { fontSize: 11, fontWeight: '600' },
  metaTxt:       { fontSize: 11, color: C.textMuted },

  offlinePill:   { flexDirection: 'row', alignItems: 'center', gap: 3,
                   backgroundColor: '#4ade8018', borderRadius: 999,
                   paddingHorizontal: 6, paddingVertical: 2 },
  offlineTxt:    { fontSize: 10, fontWeight: '700', color: '#4ade80' },

  progWrap:      { height: 4, backgroundColor: C.border, borderRadius: 2,
                   marginTop: 4, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  progBar:       { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progTxt:       { position: 'absolute', right: 0, fontSize: 9, color: C.textMuted },

  dlBtn:         { paddingHorizontal: 14, paddingVertical: 14, alignSelf: 'stretch',
                   justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: C.border },
})
