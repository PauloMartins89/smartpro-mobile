// @ts-nocheck
/**
 * DDS — Tela 3: Coleta de assinaturas (uma por vez)
 * Usa PanResponder para capturar traço do dedo.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder,
  useWindowDimensions, ActivityIndicator, Alert, PixelRatio,
} from 'react-native'
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ScreenOrientation from 'expo-screen-orientation'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { C } from '../../src/lib/theme'

// Converte array de strokes em SVG suavizado com Bézier quadrático (midpoint)
function strokesToSvg(strokes: number[][][], padW: number, padH: number): string {
  const paths = strokes.map(pts => {
    if (pts.length === 0) return ''
    if (pts.length === 1) {
      const [x, y] = pts[0]
      return `M${x.toFixed(1)},${y.toFixed(1)} l0.1,0`
    }
    // Algoritmo de ponto médio: suaviza o traço com curvas quadráticas
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i][0] + pts[i + 1][0]) / 2).toFixed(1)
      const my = ((pts[i][1] + pts[i + 1][1]) / 2).toFixed(1)
      d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx},${my}`
    }
    const last = pts[pts.length - 1]
    d += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`
    return d
  }).filter(Boolean)
  if (!paths.length) return ''

  // Auto-trim: bounding box de todos os pontos + padding
  const PADDING = 8
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const pts of strokes) {
    for (const [x, y] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  const vx = Math.max(0, minX - PADDING)
  const vy = Math.max(0, minY - PADDING)
  const vw = Math.min(padW, maxX - minX + PADDING * 2)
  const vh = Math.min(padH, maxY - minY + PADDING * 2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}" viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${vw.toFixed(0)} ${vh.toFixed(0)}" preserveAspectRatio="xMidYMid meet"><path d="${paths.join(' ')}" stroke="#1a1a1a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

// Renderiza os strokes como segmentos de linha usando Views rotacionados
// Espessura ajustada ao PixelRatio do dispositivo para traço nítido
function DrawingCanvas({ strokes, padW, padH }: { strokes: number[][][]; padW: number; padH: number }) {
  const strokeW = Math.max(1.5, 2.5 / PixelRatio.get())
  const segments: { x: number; y: number; len: number; angle: number }[] = []
  for (const pts of strokes) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[i + 1]
      const dx = x2 - x1, dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 0.5) continue
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      segments.push({ x: x1, y: y1, len, angle })
    }
  }
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: padW, height: padH }}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: seg.x,
            top: seg.y - strokeW / 2,
            width: seg.len + strokeW,
            height: strokeW,
            backgroundColor: '#1a1a1a',
            borderRadius: strokeW,
            transform: [{ rotate: `${seg.angle}deg` }],
            transformOrigin: '0 50%',
          }}
        />
      ))}
    </View>
  )
}

export default function DDSAssinaturasScreen() {
  const nav    = useNavigation()
  const router = useRouter()
  const { registroId, temaTitulo, colaboradores: colabsParam } = useLocalSearchParams<{ registroId: string; temaTitulo: string; colaboradores: string }>()

  const colaboradores: { id: string; nome: string }[] = colabsParam ? JSON.parse(colabsParam) : []
  const total = colaboradores.length

  const { width: W, height: H } = useWindowDimensions()
  const isLandscape = W > H
  const padW = W - 48
  const padH = isLandscape ? H - 160 : 180

  const [idx,     setIdx]     = useState(0)
  const [strokes, setStrokes] = useState<number[][][]>([])
  const [saving,  setSaving]  = useState(false)
  const [jaAssinaramIds, setJaAssinaramIds] = useState<Set<string>>(new Set())
  const [loadingCheck,   setLoadingCheck]   = useState(true)
  const currentStroke = useRef<number[][]>([])
  const padRef    = useRef<any>(null)
  const padOffset = useRef({ x: 0, y: 0 })
  const insets    = useSafeAreaInsets()

  const atual = colaboradores[idx]
  const jaAssinou = !!(atual?.id && jaAssinaramIds.has(atual.id))

  useEffect(() => { nav.setOptions({ title: `Assinatura ${idx + 1} / ${total}` }) }, [idx, total])

  // Carrega quem já assinou nesta sessão
  useEffect(() => {
    if (!registroId) { setLoadingCheck(false); return }
    supabase
      .from('dds_assinaturas')
      .select('colaborador_id')
      .eq('registro_id', registroId)
      .not('colaborador_id', 'is', null)
      .then(({ data }) => {
        setJaAssinaramIds(new Set((data || []).map((a: any) => a.colaborador_id)))
        setLoadingCheck(false)
      })
  }, [registroId])

  // Permite landscape nesta tela, volta para portrait ao sair
  useFocusEffect(useCallback(() => {
    ScreenOrientation.unlockAsync()
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP) }
  }, []))

  function medirPad() {
    padRef.current?.measure((_x: number, _y: number, _w: number, _h: number, pageX: number, pageY: number) => {
      padOffset.current = { x: pageX, y: pageY }
    })
  }

  // PanResponder para capturar toque
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (_, g) => {
        currentStroke.current = [[g.x0 - padOffset.current.x, g.y0 - padOffset.current.y]]
      },
      onPanResponderMove: (_, g) => {
        currentStroke.current.push([g.moveX - padOffset.current.x, g.moveY - padOffset.current.y])
        setStrokes(prev => [...prev.slice(0, -1), [...currentStroke.current]])
      },
      onPanResponderRelease: () => {
        setStrokes(prev => {
          const last = currentStroke.current
          currentStroke.current = []
          if (!prev.length || prev[prev.length - 1] !== last) return [...prev, last]
          return prev
        })
      },
    })
  ).current

  function limpar() {
    setStrokes([])
    currentStroke.current = []
  }

  async function finalizarRegistro() {
    const { count } = await supabase
      .from('dds_assinaturas')
      .select('*', { count: 'exact', head: true })
      .eq('registro_id', registroId)
    await supabase
      .from('dds_registros')
      .update({ status: 'concluido', total_assinantes: count || 0, concluido_em: new Date().toISOString() })
      .eq('id', registroId)
    router.replace({
      pathname: '/dds/concluido',
      params: { registroId, temaTitulo, totalAssinantes: String(count || 0), colaboradores: colabsParam },
    })
  }

  async function pular() {
    if (idx + 1 >= total) {
      setSaving(true)
      try { await finalizarRegistro() } finally { setSaving(false) }
    } else {
      setIdx(i => i + 1)
      setStrokes([])
      currentStroke.current = []
    }
  }

  async function salvarEAvancar() {
    if (jaAssinou) { await pular(); return }
    if (strokes.length === 0 || strokes.every(s => s.length === 0)) {
      Alert.alert('Assinatura vazia', 'Por favor, assine antes de continuar.'); return
    }
    setSaving(true)
    try {
      const svg = strokesToSvg(strokes, padW, padH)
      await supabase.from('dds_assinaturas').insert({
        registro_id:     registroId,
        colaborador_id:  atual.id || null,
        colaborador_nome: atual.nome,
        assinatura_svg:  svg,
        assinado_em:     new Date().toISOString(),
      })
      if (idx + 1 >= total) {
        await finalizarRegistro()
      } else {
        setIdx(i => i + 1)
        setStrokes([])
        currentStroke.current = []
      }
    } catch (e) {
      Alert.alert('Erro', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function voltarAnterior() {
    if (idx === 0) { router.back(); return }
    setIdx(i => i - 1)
    setStrokes([])
    currentStroke.current = []
  }

  const progress = ((idx) / total) * 100

  return (
    <View style={s.container}>
      {/* Progress bar */}
      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={s.content}>
        {/* Contador e nome */}
        <Text style={s.contador}>{idx + 1} / {total}</Text>
        <Text style={s.nome}>{atual?.nome}</Text>

        {loadingCheck ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : jaAssinou ? (
          <View style={s.jaAssinouBox}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={s.jaAssinouText}>Já assinou</Text>
            <Text style={s.jaAssinouSub}>Esta pessoa já tem assinatura registrada nesta sessão.</Text>
          </View>
        ) : (
          <>
            <Text style={s.instrucao}>Assine no campo abaixo</Text>
            {/* Pad de assinatura */}
            <View style={[s.padWrap, { width: padW }]}>
              <View
                ref={padRef}
                style={[s.pad, { width: padW, height: padH }]}
                onLayout={medirPad}
                {...panResponder.panHandlers}>
                <DrawingCanvas strokes={strokes} padW={padW} padH={padH} />
                {strokes.length === 0 && (
                  <Text style={s.padPlaceholder}>← assine aqui →</Text>
                )}
                {/* linha guia */}
                <View style={s.linha} />
              </View>
              <TouchableOpacity style={s.btnLimpar} onPress={limpar}>
                <Ionicons name="trash-outline" size={16} color={C.textSub} />
                <Text style={s.btnLimparText}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Navegação inferior */}
      <View style={[s.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={s.btnVoltar} onPress={voltarAnterior} disabled={saving}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
          <Text style={s.btnVoltarText}>{idx === 0 ? 'Voltar' : 'Anterior'}</Text>
        </TouchableOpacity>

        {!jaAssinou && (
          <TouchableOpacity style={[s.btnPular, saving && { opacity: 0.5 }]} onPress={pular} disabled={saving}>
            <Text style={s.btnPularText}>Pular</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.btnProximo, saving && { opacity: 0.5 }]} onPress={salvarEAvancar} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.btnProximoText}>
                {idx + 1 === total ? '✅ Finalizar' : jaAssinou ? 'Próximo →' : 'Assinar →'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  progressBg:      { height: 4, backgroundColor: C.border },
  progressFill:    { height: 4, backgroundColor: C.primary },
  content:         { flex: 1, padding: 24, alignItems: 'center' },
  contador:        { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 4 },
  nome:            { fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 6 },
  instrucao:       { fontSize: 13, color: C.textMuted, marginBottom: 24 },
  padWrap:         { alignItems: 'flex-end' },
  pad:             {
    backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  padPlaceholder:  { fontSize: 14, color: C.textMuted, userSelect: 'none' },
  linha:           { position: 'absolute', bottom: 40, left: 20, right: 20, height: 1, backgroundColor: C.border },
  btnLimpar:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 4, paddingHorizontal: 8 },
  btnLimparText:   { fontSize: 13, color: C.textSub },
  jaAssinouBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 20, marginTop: 20 },
  jaAssinouText:   { fontSize: 22, fontWeight: '900', color: '#10b981', textAlign: 'center' },
  jaAssinouSub:    { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  footer:          { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCard },
  btnVoltar:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, padding: 14 },
  btnVoltarText:   { fontSize: 15, fontWeight: '700', color: C.text },
  btnPular:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: '#f59e0b', padding: 14 },
  btnPularText:    { fontSize: 14, fontWeight: '700', color: '#f59e0b' },
  btnProximo:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.navy, borderRadius: 12, padding: 14 },
  btnProximoText:  { fontSize: 15, fontWeight: '800', color: '#fff' },
})
