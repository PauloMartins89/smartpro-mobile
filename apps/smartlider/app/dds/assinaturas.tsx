// @ts-nocheck
/**
 * DDS — Tela 3: Coleta de assinaturas (uma por vez)
 * Usa PanResponder para capturar traço do dedo.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder,
  useWindowDimensions, ActivityIndicator, Alert,
} from 'react-native'
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ScreenOrientation from 'expo-screen-orientation'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { C } from '../../src/lib/theme'

// Converte array de strokes em SVG path data compacto
function strokesToSvg(strokes: number[][][], padW: number, padH: number): string {
  const paths = strokes.map(pts => {
    if (pts.length === 0) return ''
    const [fx, fy] = pts[0]
    const rest = pts.slice(1).map(([x, y]) => `L${x.toFixed(0)},${y.toFixed(0)}`).join(' ')
    return `M${fx.toFixed(0)},${fy.toFixed(0)} ${rest}`
  }).filter(Boolean)
  if (!paths.length) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${padW}" height="${padH}" viewBox="0 0 ${padW} ${padH}"><path d="${paths.join(' ')}" stroke="#000000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

// Renderiza os strokes como segmentos de linha usando Views rotacionados
function DrawingCanvas({ strokes, padW, padH }: { strokes: number[][][]; padW: number; padH: number }) {
  const segments: { x: number; y: number; len: number; angle: number }[] = []
  for (const pts of strokes) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[i + 1]
      const dx = x2 - x1, dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue
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
            top: seg.y - 1.25,
            width: seg.len,
            height: 2.5,
            backgroundColor: '#000000',
            borderRadius: 2,
            transform: [{ rotate: `${seg.angle}deg` }, { translateX: 0 }],
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
  const currentStroke = useRef<number[][]>([])
  const padRef    = useRef<any>(null)
  const padOffset = useRef({ x: 0, y: 0 })
  const insets    = useSafeAreaInsets()

  const atual = colaboradores[idx]

  useEffect(() => { nav.setOptions({ title: `Assinatura ${idx + 1} / ${total}` }) }, [idx, total])

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

  async function salvarEAvancar() {
    if (strokes.length === 0 || strokes.every(s => s.length === 0)) {
      Alert.alert('Assinatura vazia', 'Por favor, assine antes de continuar.'); return
    }
    setSaving(true)
    try {
      const svg = strokesToSvg(strokes, padW, padH)
      await supabase.from('dds_assinaturas').insert({
        registro_id:     registroId,
        colaborador_id:  atual.id,
        colaborador_nome: atual.nome,
        assinatura_svg:  svg,
        assinado_em:     new Date().toISOString(),
      })

      if (idx + 1 >= total) {
        // Último — conclui o registro
        await supabase.from('dds_registros')
          .update({ status: 'concluido', total_assinantes: total, concluido_em: new Date().toISOString() })
          .eq('id', registroId)
        router.replace({
          pathname: '/dds/concluido',
          params: { registroId, temaTitulo, totalAssinantes: String(total), colaboradores: colabsParam },
        })
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
      </View>

      {/* Navegação inferior */}
      <View style={[s.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={s.btnVoltar} onPress={voltarAnterior} disabled={saving}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
          <Text style={s.btnVoltarText}>{idx === 0 ? 'Voltar' : 'Anterior'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btnProximo, saving && { opacity: 0.5 }]} onPress={salvarEAvancar} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Text style={s.btnProximoText}>
                  {idx + 1 === total ? '✅ Finalizar' : 'Próximo →'}
                </Text>
              </>
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
  footer:          { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCard },
  btnVoltar:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, padding: 14 },
  btnVoltarText:   { fontSize: 15, fontWeight: '700', color: C.text },
  btnProximo:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.navy, borderRadius: 12, padding: 14 },
  btnProximoText:  { fontSize: 15, fontWeight: '800', color: '#fff' },
})
