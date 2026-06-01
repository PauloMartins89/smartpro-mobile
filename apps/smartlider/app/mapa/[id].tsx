// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Dimensions, ScrollView, Alert,
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../src/lib/supabase'
import { C } from '../../src/lib/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const LOCAL_DIR = (FileSystem.cacheDirectory ?? '') + 'mapas/'
const localPath = (id) => LOCAL_DIR + id + '.png'

// Converte lat/lng → posição proporcional (0–1) na imagem
function gpsToFrac(lat, lng, sw_lat, sw_lng, ne_lat, ne_lng) {
  const x = (lng - sw_lng) / (ne_lng - sw_lng)           // esquerda→direita
  const y = (ne_lat - lat) / (ne_lat - sw_lat)           // topo→base (invertido)
  return { x, y }
}

// Verifica se posição está dentro do bbox do mapa
function dentroDoMapa(lat, lng, mapa) {
  return lat >= mapa.sw_lat && lat <= mapa.ne_lat &&
         lng >= mapa.sw_lng && lng <= mapa.ne_lng
}

// ── Trajeto helpers ───────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function calcDistancia(pontos) {
  let d = 0
  for (let i = 1; i < pontos.length; i++)
    d += haversine(pontos[i - 1].lat, pontos[i - 1].lng, pontos[i].lat, pontos[i].lng)
  return d
}
function formatDur(seg) {
  const m = Math.floor(seg / 60), s = seg % 60
  return m > 0 ? `${m}min ${s}s` : `${s}s`
}

// Área pelo método de Shoelace (Gauss) com projeção Cartesiana local em metros
function calcArea(pontos) {
  if (pontos.length < 3) return 0
  const lat0 = pontos[0].lat * Math.PI / 180
  const pts  = pontos.map(p => ({
    x: (p.lng - pontos[0].lng) * Math.cos(lat0) * 111320,
    y: (p.lat - pontos[0].lat) * 111320,
  }))
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area) / 2
}
function fmtArea(m2) {
  const ha = m2 / 10000
  if (ha >= 0.1) return `${ha.toFixed(2)} ha (${Math.round(m2).toLocaleString('pt-BR')} m²)`
  return `${Math.round(m2).toLocaleString('pt-BR')} m²`
}
function fmtPerimetro(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${Math.round(m)} m`
}
function stddev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length)
}

// Componente reutilizável para itens do menu
function ActionItem({ icon, label, sub, color, onPress }) {
  return (
    <TouchableOpacity style={sti.actionItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={color ?? C.text} />
      <View style={{ flex: 1 }}>
        <Text style={[sti.actionLabel, color && { color }]}>{label}</Text>
        {!!sub && <Text style={sti.actionSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
    </TouchableOpacity>
  )
}

export default function MapaViewerScreen() {
  const { id }    = useLocalSearchParams()
  const nav       = useNavigation()
  const insets    = useSafeAreaInsets()

  const [mapa,     setMapa]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [imgSize,  setImgSize]  = useState({ w: SCREEN_W, h: SCREEN_W })
  const [scale,    setScale]    = useState(1)
  const [gps,      setGps]      = useState(null)     // { latitude, longitude, accuracy }
  const [gpsErr,   setGpsErr]   = useState(null)
  const [tracking, setTracking] = useState(false)
  const [fora,     setFora]     = useState(false)
  const [gravando,  setGravando]  = useState(false)
  const [trajeto,   setTrajeto]   = useState([])      // [{lat, lng, ts}]
  const [inicioTs,  setInicioTs]  = useState(null)
  const [modo,      setModo]      = useState('linha') // 'linha' | 'poligonal'
  const locSub      = useRef(null)
  const gravarRef   = useRef(false)
  const trajetoRef  = useRef([])
  const modoRef     = useRef('linha')
  const baseScaleRef = useRef(1)
  const hScrollRef   = useRef(null)
  const vScrollRef   = useRef(null)
  const scrollXRef   = useRef(0)
  const scrollYRef   = useRef(0)

  // ── UI modals ────────────────────────────────────────────────────
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [coordModal,  setCoordModal]  = useState(false)
  const [mediaModal,  setMediaModal]  = useState(false)
  const [trajModal,   setTrajModal]   = useState(false)
  // ── Cache offline ────────────────────────────────────────────────
  const [localUri,    setLocalUri]    = useState(null)
  // ── Busca por coordenadas ───────────────────────────────────────
  const [coordLat,    setCoordLat]    = useState('')
  const [coordLng,    setCoordLng]    = useState('')
  const [coordPin,    setCoordPin]    = useState(null)  // {lat, lng, label?}
  // ── Média GPS ────────────────────────────────────────────────────
  const [mediaSamples, setMediaSamples] = useState([])
  const [mediaAtivo,   setMediaAtivo]   = useState(false)
  const mediaTimerRef  = useRef(null)
  // ── Pontos plotados (fotos) ───────────────────────────────────────
  const [pontos,       setPontos]       = useState([])
  // ── Histórico de trajetos ───────────────────────────────────────
  const [trajetosHist, setTrajetosHist] = useState([])
  const [trajetoVer,   setTrajetoVer]   = useState(null)
  const [fullscreen,   setFullscreen]   = useState(false)

  // ── Carrega dados do mapa ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lider_mapas')
        .select('*')
        .eq('id', id)
        .single()
      if (!data) return
      setMapa(data)
      nav.setOptions({ title: data.nome })

      // Calcula altura proporcional da imagem
      Image.getSize(data.imagem_url, (iw, ih) => {
        const h = (SCREEN_W / iw) * ih
        setImgSize({ w: SCREEN_W, h })
      })
      // Verifica cache local
      const info = await FileSystem.getInfoAsync(localPath(id))
      if (info.exists) setLocalUri(localPath(id))
      setLoading(false)
    }
    load()
  }, [id])

  // Fullscreen: toggle navigation header
  useEffect(() => {
    nav.setOptions({ headerShown: !fullscreen })
  }, [fullscreen, nav])

  // ── GPS tracking ──────────────────────────────────────────────────────────
  const iniciarGPS = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      setGpsErr('Permissão de localização negada.')
      return
    }
    setTracking(true)
    setGpsErr(null)

    locSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 2,
      },
      (loc) => {
        const { latitude, longitude, accuracy } = loc.coords
        setGps({ latitude, longitude, accuracy })
        if (mapa) setFora(!dentroDoMapa(latitude, longitude, mapa))
        if (gravarRef.current) {
          const pt = { lat: latitude, lng: longitude, ts: Date.now() }
          trajetoRef.current = [...trajetoRef.current, pt]
          setTrajeto([...trajetoRef.current])
        }
      }
    )
  }, [mapa])

  const pararGPS = useCallback(() => {
    locSub.current?.remove()
    locSub.current = null
    setTracking(false)
    setGps(null)
    setFora(false)
    // Para gravação junto com GPS
    gravarRef.current = false
    setGravando(false)
  }, [])

  // ── Gravação de trajeto ───────────────────────────────────────────────────
  const toggleModo = useCallback(() => {
    const next = modoRef.current === 'linha' ? 'poligonal' : 'linha'
    modoRef.current = next
    setModo(next)
  }, [])

  const iniciarGravacao = useCallback(() => {
    trajetoRef.current = []
    setTrajeto([])
    setInicioTs(Date.now())
    gravarRef.current = true
    setGravando(true)
  }, [])

  const pararGravacao = useCallback(() => {
    gravarRef.current = false
    setGravando(false)
    const pontos  = trajetoRef.current
    const isPoly  = modoRef.current === 'poligonal'
    const minPts  = isPoly ? 3 : 2
    if (pontos.length < minPts) {
      Alert.alert('Medição muito curta', `Mínimo ${minPts} pontos para ${isPoly ? 'poligonal' : 'trajeto'}.`)
      trajetoRef.current = []
      setTrajeto([])
      return
    }
    const distM  = calcDistancia(pontos)
    const areaM2 = isPoly ? calcArea(pontos) : 0
    const durSeg = Math.round((Date.now() - inicioTs) / 1000)
    const linhas = [
      `${pontos.length} pontos`,
      isPoly
        ? `Perímetro: ${fmtPerimetro(distM)}`
        : `Distância: ${fmtPerimetro(distM)}`,
      isPoly ? `Área: ${fmtArea(areaM2)}` : null,
      `Duração: ${formatDur(durSeg)}`,
    ].filter(Boolean).join('\n')
    Alert.alert(
      isPoly ? 'Salvar poligonal?' : 'Salvar trajeto?',
      linhas,
      [
        { text: 'Descartar', style: 'destructive', onPress: () => { trajetoRef.current = []; setTrajeto([]) } },
        { text: 'Salvar', onPress: () => salvarTrajeto(pontos, distM, areaM2, durSeg) },
      ]
    )
  }, [inicioTs])

  const salvarTrajeto = useCallback(async (pontos, distM, areaM2, durSeg) => {
    const { data: { user } } = await supabase.auth.getUser()
    const isPoly = modoRef.current === 'poligonal'
    const { error } = await supabase.from('lider_trajetos').insert({
      mapa_id:      mapa?.id,
      workspace_id: mapa?.workspace_id,
      criado_por:   user?.id ?? null,
      tipo:         isPoly ? 'poligonal' : 'linha',
      pontos,
      perimetro_m:  Math.round(distM),
      area_m2:      isPoly ? Math.round(areaM2) : null,
      duracao_s:    durSeg,
    })
    if (error) {
      Alert.alert('Erro ao salvar', error.message)
    } else {
      const msg = isPoly
        ? `Poligonal: ${fmtArea(areaM2)}\nPerímetro: ${fmtPerimetro(distM)}`
        : `Trajeto de ${fmtPerimetro(distM)} salvo.`
      Alert.alert('Salvo!', msg)
      trajetoRef.current = []
      setTrajeto([])
    }
  }, [mapa])

  // ── Ações do menu ──────────────────────────────────────────────────────────

  const abrirGoogleMaps = useCallback(() => {
    if (!gps) { Alert.alert('GPS desligado', 'Ligue o GPS primeiro.'); return }
    const { latitude, longitude } = gps
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}`
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)
    )
    setMenuOpen(false)
  }, [gps])

  const buscarCoordenadas = useCallback(() => {
    const lat = parseFloat(coordLat.replace(',', '.'))
    const lng = parseFloat(coordLng.replace(',', '.'))
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Coordenadas inválidas', 'Informe valores válidos de latitude e longitude.')
      return
    }
    setCoordPin({ lat, lng })
    setCoordModal(false)
  }, [coordLat, coordLng])

  const iniciarMediaGPS = useCallback(() => {
    if (!tracking) { Alert.alert('GPS desligado', 'Ligue o GPS primeiro.'); return }
    setMediaSamples([])
    setMediaAtivo(true)
    setMenuOpen(false)
    setMediaModal(true)
  }, [tracking])

  const coletarAmostra = useCallback(() => {
    if (gps) setMediaSamples(prev => [...prev, { lat: gps.latitude, lng: gps.longitude }])
  }, [gps])

  useEffect(() => {
    if (mediaAtivo) { mediaTimerRef.current = setInterval(coletarAmostra, 2000) }
    else            { clearInterval(mediaTimerRef.current) }
    return () => clearInterval(mediaTimerRef.current)
  }, [mediaAtivo, coletarAmostra])

  const marcarMediaGPS = useCallback((samples) => {
    const lat = samples.reduce((s, p) => s + p.lat, 0) / samples.length
    const lng = samples.reduce((s, p) => s + p.lng, 0) / samples.length
    setCoordPin({ lat, lng, label: `Média (${samples.length} pts)` })
    setMediaAtivo(false)
    setMediaModal(false)
  }, [])

  const plotarFoto = useCallback(async () => {
    setMenuOpen(false)
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (result.canceled) return
    if (!gps) { Alert.alert('GPS desligado', 'Ligue o GPS para georreferenciar a foto.'); return }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const foto = result.assets[0]
      const nome = `pontos/${Date.now()}.jpg`
      const resp = await fetch(foto.uri)
      const blob = await resp.blob()
      const { error: upErr } = await supabase.storage
        .from('mapas-lider').upload(nome, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('mapas-lider').getPublicUrl(nome)
      const { data: pt, error: dbErr } = await supabase.from('lider_pontos').insert({
        mapa_id: mapa?.id, workspace_id: mapa?.workspace_id,
        criado_por: user?.id ?? null,
        lat: gps.latitude, lng: gps.longitude,
        foto_url: publicUrl,
      }).select().single()
      if (dbErr) throw dbErr
      setPontos(prev => [...prev, pt])
    } catch (e) { Alert.alert('Erro ao plotar foto', e.message) }
  }, [gps, mapa])

  const carregarPontos = useCallback(async () => {
    if (!mapa?.id) return
    const { data } = await supabase.from('lider_pontos')
      .select('id, lat, lng, foto_url, descricao').eq('mapa_id', mapa.id)
    setPontos(data ?? [])
  }, [mapa])

  const carregarTrajetos = useCallback(async () => {
    if (!mapa?.id) return
    const { data } = await supabase.from('lider_trajetos')
      .select('id, tipo, pontos, perimetro_m, area_m2, criado_em')
      .eq('mapa_id', mapa.id).order('criado_em', { ascending: false }).limit(30)
    setTrajetosHist(data ?? [])
  }, [mapa])

  useEffect(() => {
    if (mapa) { carregarPontos(); carregarTrajetos() }
  }, [mapa, carregarPontos, carregarTrajetos])

  useEffect(() => () => locSub.current?.remove(), [])

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const scrollToCenter = (newScale: number, oldScale: number, focalX = SCREEN_W / 2, focalY = SCREEN_H / 2) => {
    const ratio = newScale / oldScale
    const newX  = Math.max(0, (scrollXRef.current + focalX) * ratio - focalX)
    const newY  = Math.max(0, (scrollYRef.current + focalY) * ratio - focalY)
    setTimeout(() => {
      hScrollRef.current?.scrollTo({ x: newX, animated: false })
      vScrollRef.current?.scrollTo({ y: newY, animated: false })
    }, 0)
  }

  const zoomIn  = () => {
    const oldScale = baseScaleRef.current
    const n = Math.min(oldScale + 0.5, 4)
    baseScaleRef.current = n
    setScale(n)
    scrollToCenter(n, oldScale)
  }
  const zoomOut = () => {
    const oldScale = baseScaleRef.current
    const n = Math.max(oldScale - 0.5, 0.5)
    baseScaleRef.current = n
    setScale(n)
    scrollToCenter(n, oldScale)
  }

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => { baseScaleRef.current = scale })
    .onUpdate(e => {
      const next = Math.min(4, Math.max(0.5, baseScaleRef.current * e.scale))
      setScale(next)
    })
    .onEnd(e => {
      const oldScale = baseScaleRef.current
      const newScale = Math.min(4, Math.max(0.5, oldScale * e.scale))
      baseScaleRef.current = newScale
      scrollToCenter(newScale, oldScale, e.focalX, e.focalY)
    })

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || !mapa) return (
    <View style={st.center}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  )

  // ── Dimensões da imagem com zoom aplicado ─────────────────────────────────
  const mapW = imgSize.w * scale
  const mapH = imgSize.h * scale

  // ── Posição do dot GPS na imagem ──────────────────────────────────────────
  let dotX = null, dotY = null
  if (gps) {
    const frac = gpsToFrac(gps.latitude, gps.longitude,
                           mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
    dotX = frac.x * mapW
    dotY = frac.y * mapH
  }

  // ── Raio de precisão em pixels ────────────────────────────────────────────
  // metros por grau latitude ≈ 111320m
  // pixels por metro = mapW / ((ne_lng - sw_lng) * 111320 * cos(lat))
  let accuracyRadius = 0
  if (gps && gps.accuracy) {
    const metersPerPx = ((mapa.ne_lng - mapa.sw_lng) * 111320) / mapW
    accuracyRadius = gps.accuracy / metersPerPx
  }

  return (
    <View style={[st.root, !fullscreen && { paddingBottom: insets.bottom }]}>
      {/* Aviso fora do mapa */}
      {fora && (
        <View style={st.warningBar}>
          <Ionicons name="warning-outline" size={16} color="#fff" />
          <Text style={st.warningTxt}>Você está fora da área deste mapa</Text>
        </View>
      )}

      {/* Mapa com GPS overlay */}
      <GestureDetector gesture={pinchGesture}>
      <ScrollView
        ref={vScrollRef}
        style={st.scroll}
        contentContainerStyle={{ width: mapW, minHeight: mapH }}
        horizontal={false}
        showsVerticalScrollIndicator={false}
        onScroll={e => { scrollYRef.current = e.nativeEvent.contentOffset.y }}
        scrollEventThrottle={16}>
        <ScrollView
          ref={hScrollRef}
          horizontal
          contentContainerStyle={{ width: mapW }}
          showsHorizontalScrollIndicator={false}
          onScroll={e => { scrollXRef.current = e.nativeEvent.contentOffset.x }}
          scrollEventThrottle={16}>
          <View style={{ width: mapW, height: mapH }}>
            {/* Imagem do mapa (local cache ou URL) */}
            <Image
              source={{ uri: localUri ?? mapa.imagem_url }}
              style={{ width: mapW, height: mapH }}
              resizeMode="stretch"
            />

            {/* ── Trajeto gravado ── */}
            {/* Fecho do polígono: último → primeiro ponto */}
            {modo === 'poligonal' && trajeto.length >= 3 && (() => {
              const pt1 = trajeto[trajeto.length - 1]
              const pt2 = trajeto[0]
              const f1  = gpsToFrac(pt1.lat, pt1.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              const f2  = gpsToFrac(pt2.lat, pt2.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              const x1 = f1.x * mapW, y1 = f1.y * mapH
              const x2 = f2.x * mapW, y2 = f2.y * mapH
              const dx = x2 - x1, dy = y2 - y1
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len < 1) return null
              const angle = Math.atan2(dy, dx) * 180 / Math.PI
              return (
                <View
                  key="seg-close"
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: (x1 + x2) / 2 - len / 2,
                    top:  (y1 + y2) / 2 - 2,
                    width: len,
                    height: 4,
                    backgroundColor: '#f59e0b',
                    borderRadius: 2,
                    opacity: 0.88,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              )
            })()}
            {trajeto.length > 1 && trajeto.slice(0, -1).map((pt, i) => {
              const pt2 = trajeto[i + 1]
              const f1  = gpsToFrac(pt.lat,  pt.lng,  mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              const f2  = gpsToFrac(pt2.lat, pt2.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              const x1 = f1.x * mapW, y1 = f1.y * mapH
              const x2 = f2.x * mapW, y2 = f2.y * mapH
              const dx = x2 - x1, dy = y2 - y1
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len < 1) return null
              const angle = Math.atan2(dy, dx) * 180 / Math.PI
              return (
                <View
                  key={`seg-${i}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: (x1 + x2) / 2 - len / 2,
                    top:  (y1 + y2) / 2 - 2,
                    width: len,
                    height: 4,
                    backgroundColor: '#ef4444',
                    borderRadius: 2,
                    opacity: 0.88,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              )
            })}

            {/* Dot GPS */}
            {dotX !== null && dotY !== null && (
              <View style={[st.dotWrap, { left: dotX - 14, top: dotY - 14 }]}>
                {/* Círculo de precisão */}
                {accuracyRadius > 6 && (
                  <View style={[st.accuracy, {
                    width: accuracyRadius * 2,
                    height: accuracyRadius * 2,
                    borderRadius: accuracyRadius,
                    marginLeft: -(accuracyRadius - 14),
                    marginTop: -(accuracyRadius - 14),
                  }]} />
                )}
                {/* Ponto central */}
                <View style={st.dotOuter}>
                  <View style={st.dotInner} />
                </View>
              </View>
            )}

            {/* Pino de coordenada buscada / média GPS */}
            {coordPin && (() => {
              const f = gpsToFrac(coordPin.lat, coordPin.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              return (
                <View pointerEvents="none" style={[st.coordPin, { left: f.x * mapW - 14, top: f.y * mapH - 32 }]}>
                  <Ionicons name="location" size={28} color="#f59e0b" />
                  {!!coordPin.label && <Text style={st.coordPinLabel}>{coordPin.label}</Text>}
                </View>
              )
            })()}

            {/* Pontos / fotos plotadas */}
            {pontos.map(p => {
              const f = gpsToFrac(p.lat, p.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[st.pontoBtn, { left: f.x * mapW - 14, top: f.y * mapH - 14 }]}
                  onPress={() => Alert.alert('Foto plotada', `${p.lat.toFixed(6)}°, ${p.lng.toFixed(6)}°`)}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </TouchableOpacity>
              )
            })}

            {/* Trajeto do histórico selecionado (azul) */}
            {trajetoVer?.pontos?.length > 1 && trajetoVer.pontos.slice(0, -1).map((pt, i) => {
              const pt2 = trajetoVer.pontos[i + 1]
              const f1 = gpsToFrac(pt.lat, pt.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              const f2 = gpsToFrac(pt2.lat, pt2.lng, mapa.sw_lat, mapa.sw_lng, mapa.ne_lat, mapa.ne_lng)
              const x1 = f1.x * mapW, y1 = f1.y * mapH, x2 = f2.x * mapW, y2 = f2.y * mapH
              const dx = x2 - x1, dy = y2 - y1
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len < 1) return null
              const angle = Math.atan2(dy, dx) * 180 / Math.PI
              return (
                <View key={`hist-${i}`} pointerEvents="none" style={{
                  position: 'absolute',
                  left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 2,
                  width: len, height: 4,
                  backgroundColor: '#3b82f6', borderRadius: 2, opacity: 0.85,
                  transform: [{ rotate: `${angle}deg` }],
                }} />
              )
            })}
          </View>
        </ScrollView>
      </ScrollView>
      </GestureDetector>

      {/* ── Floating Toolbar (direita) ──────────────────────────────────────── */}
      <View style={[st.toolbar, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[st.toolBtn, tracking && st.toolBtnGps]}
          onPress={tracking ? pararGPS : iniciarGPS}
          activeOpacity={0.85}>
          <Ionicons name={tracking ? 'locate' : 'locate-outline'} size={22} color={tracking ? '#fff' : C.text} />
        </TouchableOpacity>
        <View style={st.toolDivider} />
        <TouchableOpacity style={st.toolBtn} onPress={zoomIn} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity style={st.toolBtn} onPress={zoomOut} activeOpacity={0.85}>
          <Ionicons name="remove" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={st.toolDivider} />
        <TouchableOpacity style={st.toolBtn} onPress={() => setMenuOpen(true)} activeOpacity={0.85}>
          <Ionicons name="apps-outline" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={st.toolDivider} />
        <TouchableOpacity
          style={[st.toolBtn, fullscreen && st.toolBtnFull]}
          onPress={() => setFullscreen(f => !f)}
          activeOpacity={0.85}>
          <Ionicons
            name={fullscreen ? 'contract-outline' : 'expand-outline'}
            size={22}
            color={fullscreen ? C.primary ?? '#4ade80' : C.text}
          />
        </TouchableOpacity>
      </View>

      {/* ── Record + Modo pill (esquerda, aparece só com GPS ativo) ───────────── */}
      {tracking && (
        <View style={[st.recPillWrap, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[st.recPillMode, modo === 'poligonal' && st.recPillModePoly]}
            onPress={!gravando ? toggleModo : undefined}
            activeOpacity={gravando ? 1 : 0.85}>
            <Ionicons
              name={modo === 'poligonal' ? 'analytics-outline' : 'trail-sign-outline'}
              size={15}
              color={modo === 'poligonal' ? '#f59e0b' : C.textMuted}
            />
            <Text style={[st.recPillModeTxt, modo === 'poligonal' && { color: '#f59e0b' }]}>
              {modo === 'linha' ? 'Linha' : 'Área'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.recPillBtn, gravando && st.recPillBtnAtivo]}
            onPress={gravando ? pararGravacao : iniciarGravacao}
            activeOpacity={0.85}>
            <Ionicons name={gravando ? 'stop' : 'radio-button-on'} size={17} color={gravando ? '#fff' : '#ef4444'} />
            <Text style={[st.recPillBtnTxt, gravando && { color: '#fff' }]}>
              {gravando ? 'Parar' : 'Gravar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Info GPS — chip premium */}
      {gps && (
        <View style={[st.gpsChip, { top: fora ? 54 : (fullscreen ? insets.top + 10 : 10) }]}>
          <View style={[st.gpsChipDot, { backgroundColor: tracking ? '#4ade80' : '#888' }]} />
          <Text style={st.gpsInfoTxt}>
            {gps.latitude.toFixed(5)}°{'  '}{gps.longitude.toFixed(5)}°
          </Text>
          <View style={st.gpsChipPill}>
            <Text style={st.gpsChipAccTxt}>±{Math.round(gps.accuracy ?? 0)}m</Text>
          </View>
        </View>
      )}

      {/* Erro GPS */}
      {gpsErr && (
        <View style={st.errorBar}>
          <Ionicons name="alert-circle-outline" size={16} color="#fff" />
          <Text style={st.warningTxt}>{gpsErr}</Text>
        </View>
      )}

      {/* Legenda */}
      <View style={st.legend}>
        <Text style={st.legendTxt}>
          {localUri ? '☁️ Offline  ·  ' : ''}
          SW {mapa.sw_lat.toFixed(5)}°, {mapa.sw_lng.toFixed(5)}°{'  '}
          NE {mapa.ne_lat.toFixed(5)}°, {mapa.ne_lng.toFixed(5)}°
        </Text>
      </View>

      {/* Barra de gravação */}
      {gravando && (() => {
        const dist   = calcDistancia(trajeto)
        const isPoly = modo === 'poligonal'
        const area   = isPoly ? calcArea(trajeto) : 0
        return (
          <View style={[st.recBar, isPoly && st.recBarPoly]}>
            <View style={[st.recDot, isPoly && { backgroundColor: '#f59e0b' }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.recBarTxt}>
                {isPoly ? 'Poligonal' : 'Gravando'} · {trajeto.length} pt{trajeto.length !== 1 ? 's' : ''} · {fmtPerimetro(dist)}
              </Text>
              {isPoly && trajeto.length >= 3 && (
                <Text style={st.recBarArea}>
                  Área: {fmtArea(area)} · {(area / 10000).toFixed(4)} ha
                </Text>
              )}
            </View>
            <Text style={st.recBarSub}>
              {formatDur(Math.round((Date.now() - (inicioTs ?? Date.now())) / 1000))}
            </Text>
          </View>
        )
      })()}

      {/* ────────────────────────────────────────────────────────── MODALS */}

      {/* ── Action Menu (bottom sheet) ── */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={sti.overlay} onPress={() => setMenuOpen(false)} activeOpacity={1}>
          <View style={[sti.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={sti.handle} />
            <ActionItem
              icon={fullscreen ? 'contract-outline' : 'expand-outline'}
              label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              sub={fullscreen ? 'Restaurar cabeçalho' : 'Maximizar o mapa'}
              onPress={() => { setFullscreen(f => !f); setMenuOpen(false) }} />
            <ActionItem
              icon={modo === 'poligonal' ? 'analytics-outline' : 'trail-sign-outline'}
              label={`Modo: ${modo === 'linha' ? 'Linha' : 'Poligonal'}`}
              sub={modo === 'linha' ? 'Toque para mudar para Área' : 'Toque para mudar para Linha'}
              onPress={() => { toggleModo(); setMenuOpen(false) }} />
            <ActionItem
              icon={gravando ? 'stop-circle-outline' : 'radio-button-on-outline'}
              label={gravando ? 'Parar gravação' : 'Gravar trajeto'}
              color={gravando ? '#ef4444' : undefined}
              onPress={() => {
                setMenuOpen(false)
                if (gravando) { pararGravacao() }
                else if (tracking) { iniciarGravacao() }
                else { Alert.alert('GPS desligado', 'Ligue o GPS primeiro.') }
              }} />
            <ActionItem icon="search-outline" label="Buscar coordenadas"
              onPress={() => { setMenuOpen(false); setCoordModal(true) }} />
            <ActionItem icon="analytics-outline" label="Traçar média GPS"
              onPress={iniciarMediaGPS} />
            <ActionItem icon="camera-outline" label="Plotar foto aqui"
              onPress={plotarFoto} />
            <ActionItem icon="time-outline" label="Histórico de trajetos"
              onPress={() => { setMenuOpen(false); carregarTrajetos(); setTrajModal(true) }} />
            <ActionItem icon="map-outline" label="Ver no Google Maps"
              onPress={abrirGoogleMaps} />
            {coordPin && (
              <ActionItem icon="close-circle-outline" label="Remover pino do mapa"
                color="#ef4444"
                onPress={() => { setCoordPin(null); setMenuOpen(false) }} />
            )}
            <TouchableOpacity style={[sti.actionItem, { marginTop: 4 }]} onPress={() => setMenuOpen(false)}>
              <Text style={{ flex: 1, textAlign: 'center', color: C.textMuted, fontSize: 15, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Buscar coordenadas ── */}
      <Modal visible={coordModal} transparent animationType="fade" onRequestClose={() => setCoordModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={sti.overlay} onPress={() => setCoordModal(false)} activeOpacity={1}>
            <View style={[sti.dialog, { marginHorizontal: 24 }]} onStartShouldSetResponder={() => true}>
              <Text style={sti.dialogTitle}>Buscar coordenadas</Text>
              <TextInput
                style={sti.coordInput} placeholder="Latitude (ex: -19.8423)"
                placeholderTextColor={C.textMuted} keyboardType="decimal-pad"
                value={coordLat} onChangeText={setCoordLat} />
              <TextInput
                style={sti.coordInput} placeholder="Longitude (ex: -47.2198)"
                placeholderTextColor={C.textMuted} keyboardType="decimal-pad"
                value={coordLng} onChangeText={setCoordLng} />
              <View style={sti.dialogBtns}>
                <TouchableOpacity style={sti.btnCancel} onPress={() => setCoordModal(false)}>
                  <Text style={sti.btnCancelTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={sti.btnOk} onPress={buscarCoordenadas}>
                  <Text style={sti.btnOkTxt}>Ir para</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Traçar média GPS ── */}
      <Modal visible={mediaModal} transparent animationType="slide" onRequestClose={() => { setMediaAtivo(false); setMediaModal(false) }}>
        <View style={[sti.overlay, { justifyContent: 'flex-end' }]}>
          <View style={[sti.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={sti.handle} />
            <Text style={sti.dialogTitle}>Traçar média GPS</Text>
            <Text style={[sti.dialogTitle, { fontSize: 13, fontWeight: '400', color: C.textMuted, marginBottom: 8 }]}>
              {mediaAtivo ? 'Coletando amostras (a cada 2s)…' : mediaSamples.length > 0 ? 'Coleta encerrada' : 'Pronto para coletar'}
            </Text>
            <View style={{ paddingHorizontal: 20, marginBottom: 16, gap: 4 }}>
              <Text style={{ fontSize: 36, fontWeight: '800', color: C.text }}>{mediaSamples.length}</Text>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>amostras coletadas</Text>
              {mediaSamples.length > 1 && (() => {
                const lats = mediaSamples.map(s => s.lat)
                const lngs = mediaSamples.map(s => s.lng)
                const avgLat = lats.reduce((a, b) => a + b) / lats.length
                const avgLng = lngs.reduce((a, b) => a + b) / lngs.length
                const sd = stddev(lats) * 111320
                return (
                  <>
                    <Text style={{ color: C.text, fontSize: 13, fontFamily: 'monospace', marginTop: 4 }}>
                      {avgLat.toFixed(7)}°
                    </Text>
                    <Text style={{ color: C.text, fontSize: 13, fontFamily: 'monospace' }}>
                      {avgLng.toFixed(7)}°
                    </Text>
                    <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '600' }}>σ ≈ {sd.toFixed(2)} m</Text>
                  </>
                )
              })()}
            </View>
            <View style={sti.dialogBtns}>
              {mediaAtivo
                ? <TouchableOpacity style={sti.btnCancel} onPress={() => setMediaAtivo(false)}>
                    <Text style={sti.btnCancelTxt}>Pausar</Text>
                  </TouchableOpacity>
                : <TouchableOpacity style={sti.btnCancel} onPress={() => { setMediaAtivo(false); setMediaModal(false) }}>
                    <Text style={sti.btnCancelTxt}>Cancelar</Text>
                  </TouchableOpacity>
              }
              <TouchableOpacity
                style={[sti.btnOk, mediaSamples.length < 3 && { opacity: 0.4 }]}
                onPress={() => marcarMediaGPS(mediaSamples)}
                disabled={mediaSamples.length < 3}>
                <Text style={sti.btnOkTxt}>Marcar ponto ({mediaSamples.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Histórico de trajetos ── */}
      <Modal visible={trajModal} transparent animationType="slide" onRequestClose={() => setTrajModal(false)}>
        <View style={[sti.overlay, { justifyContent: 'flex-end' }]}>
          <View style={[sti.sheet, { maxHeight: '72%', paddingBottom: insets.bottom + 8 }]}>
            <View style={sti.handle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 6 }}>
              <Text style={[sti.dialogTitle, { flex: 1, paddingHorizontal: 0 }]}>Histórico de trajetos</Text>
              {trajetoVer && (
                <TouchableOpacity onPress={() => setTrajetoVer(null)}>
                  <Text style={{ color: C.primary ?? '#4ade80', fontSize: 13 }}>Limpar overlay</Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={trajetosHist}
              keyExtractor={t => t.id}
              style={{ flex: 1 }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: C.textMuted, paddingVertical: 24, fontSize: 14 }}>
                  Nenhum trajeto salvo para este mapa.
                </Text>
              }
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={[sti.trajItem, trajetoVer?.id === t.id && sti.trajItemAtivo]}
                  onPress={() => { setTrajetoVer(t); setTrajModal(false) }}>
                  <View style={[sti.trajIcon, { backgroundColor: t.tipo === 'poligonal' ? '#f59e0b22' : '#ef444422' }]}>
                    <Ionicons
                      name={t.tipo === 'poligonal' ? 'analytics-outline' : 'trail-sign-outline'}
                      size={18} color={t.tipo === 'poligonal' ? '#f59e0b' : '#ef4444'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>
                      {new Date(t.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {fmtPerimetro(t.perimetro_m ?? 0)}
                      {t.area_m2 ? `  ·  ${fmtArea(t.area_m2)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="eye-outline" size={18} color={trajetoVer?.id === t.id ? C.primary ?? '#4ade80' : C.textMuted} />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={[sti.actionItem, { marginTop: 4 }]} onPress={() => setTrajModal(false)}>
              <Text style={{ flex: 1, textAlign: 'center', color: C.textMuted, fontSize: 15, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const DOT = 20

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#111' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  scroll:      { flex: 1 },

  // GPS dot
  dotWrap:     { position: 'absolute', width: DOT + 8, height: DOT + 8, justifyContent: 'center', alignItems: 'center' },
  dotOuter:    { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#fff',
                 justifyContent: 'center', alignItems: 'center',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4,
                 shadowRadius: 4, elevation: 6 },
  dotInner:    { width: DOT * 0.55, height: DOT * 0.55, borderRadius: DOT * 0.55 / 2,
                 backgroundColor: '#4285F4' },
  accuracy:    { position: 'absolute', backgroundColor: 'rgba(66,133,244,0.18)',
                 borderWidth: 1, borderColor: 'rgba(66,133,244,0.5)' },

  // Controles
  controls:    { position: 'absolute', right: 16, flexDirection: 'column', gap: 10, alignItems: 'flex-end' },
  zoomGroup:   { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  btn:         { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  zoomSep:     { height: 1, backgroundColor: C.border ?? '#e5e7eb', marginHorizontal: 8 },
  gpsBtn:      { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
                 justifyContent: 'center', alignItems: 'center',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  gpsBtnAtivo: { backgroundColor: '#4285F4' },

  // Gravar trajeto
  recBtn:      { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
                 justifyContent: 'center', alignItems: 'center',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.2, shadowRadius: 4, elevation: 5,
                 borderWidth: 2, borderColor: '#ef4444' },
  recBtnAtivo: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  modoBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
                 justifyContent: 'center', alignItems: 'center',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  modoBtnAtivo: { backgroundColor: '#fff3cd', borderWidth: 2, borderColor: '#f59e0b' },
  recBar:      { flexDirection: 'row', alignItems: 'center', gap: 10,
                 backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 8,
                 borderTopWidth: 1, borderTopColor: '#ef444433' },
  recBarPoly:  { borderTopColor: '#f59e0b55' },
  recDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', flexShrink: 0 },
  recBarTxt:   { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recBarArea:  { color: '#f59e0b', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 1 },
  recBarSub:   { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontVariant: ['tabular-nums'] },

  // Info bars
  warningBar:  { backgroundColor: '#e67e22', flexDirection: 'row', alignItems: 'center',
                 gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  errorBar:    { position: 'absolute', top: 12, left: 16, right: 16,
                 backgroundColor: '#e74c3c', borderRadius: 10, flexDirection: 'row',
                 alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  warningTxt:  { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  gpsInfo:     { position: 'absolute', left: 12, backgroundColor: 'rgba(0,0,0,0.65)',
                 borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                 flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsInfoTxt:  { color: '#fff', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gpsInfoAcc:  { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  legend:      { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4 },
  legendTxt:   { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontVariant: ['tabular-nums'] },

  // Menu button
  menuBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
                 justifyContent: 'center', alignItems: 'center',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.2, shadowRadius: 4, elevation: 5, marginBottom: 6 },

  // Coord pin & photo pontos overlays
  coordPin:    { position: 'absolute', alignItems: 'center' },
  coordPinLabel: { fontSize: 9, color: '#f59e0b', backgroundColor: 'rgba(0,0,0,0.7)',
                   borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginTop: -4 },
  pontoBtn:    { position: 'absolute', width: 28, height: 28, borderRadius: 14,
                 backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center',
                 borderWidth: 2, borderColor: '#fff',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                 shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },

  // ── Floating Toolbar ──────────────────────────────────────────────────────
  toolbar:      { position: 'absolute', right: 16, flexDirection: 'column', alignItems: 'center',
                  backgroundColor: 'rgba(12,13,18,0.92)',
                  borderRadius: 18, overflow: 'hidden',
                  borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.55, shadowRadius: 14, elevation: 14 },
  toolBtn:      { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  toolBtnGps:   { backgroundColor: '#4285F4' },
  toolBtnFull:  { backgroundColor: 'rgba(74,222,128,0.12)' },
  toolDivider:  { width: 26, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.09)' },

  // ── Record + Mode pills (esquerda) ────────────────────────────────────────
  recPillWrap:  { position: 'absolute', left: 16, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  recPillMode:  { flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: 'rgba(12,13,18,0.92)', borderRadius: 16,
                  paddingHorizontal: 12, paddingVertical: 10,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  recPillModePoly: { borderColor: 'rgba(245,158,11,0.35)' },
  recPillModeTxt: { color: C.textMuted ?? '#9ca3af', fontSize: 13, fontWeight: '600' },
  recPillBtn:   { flexDirection: 'row', alignItems: 'center', gap: 7,
                  backgroundColor: 'rgba(12,13,18,0.92)', borderRadius: 16,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(239,68,68,0.35)',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  recPillBtnAtivo: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  recPillBtnTxt: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  // ── GPS chip ─────────────────────────────────────────────────────────────
  gpsChip:     { position: 'absolute', left: 12, flexDirection: 'row', alignItems: 'center', gap: 7,
                 backgroundColor: 'rgba(12,13,18,0.88)',
                 borderRadius: 20, paddingLeft: 10, paddingRight: 5, paddingVertical: 6,
                 borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 },
  gpsChipDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  gpsChipPill: { backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 10,
                 paddingHorizontal: 7, paddingVertical: 3, marginLeft: 2 },
  gpsChipAccTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600',
                   fontVariant: ['tabular-nums'] },
})

// ── Estilos para modals / bottom sheets ────────────────────────────────────
const sti = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.bgCard ?? '#1c2230', borderTopLeftRadius: 20,
                borderTopRightRadius: 20, paddingTop: 8, paddingHorizontal: 0 },
  handle:     { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2,
                alignSelf: 'center', marginBottom: 12 },
  dialog:     { backgroundColor: C.bgCard ?? '#1c2230', borderRadius: 16, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: C.text, paddingHorizontal: 20, marginBottom: 2 },
  coordInput: { backgroundColor: C.bg ?? '#0f1117', borderRadius: 10, borderWidth: 1,
                borderColor: C.border ?? '#2d3748', color: C.text, fontSize: 15,
                paddingHorizontal: 12, paddingVertical: 10 },
  dialogBtns: { flexDirection: 'row', gap: 10 },
  btnCancel:  { flex: 1, paddingVertical: 12, borderRadius: 10,
                backgroundColor: C.border ?? '#2d3748', alignItems: 'center' },
  btnCancelTxt: { color: C.text, fontWeight: '600' },
  btnOk:      { flex: 1, paddingVertical: 12, borderRadius: 10,
                backgroundColor: C.primary ?? '#4ade80', alignItems: 'center' },
  btnOkTxt:   { color: '#000', fontWeight: '700' },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
                gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border ?? '#2d3748' },
  actionLabel: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  actionSub:  { fontSize: 12, color: C.textMuted, marginTop: 1 },
  trajItem:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
                gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border ?? '#2d3748' },
  trajItemAtivo: { backgroundColor: 'rgba(59,130,246,0.08)' },
  trajIcon:   { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
})
