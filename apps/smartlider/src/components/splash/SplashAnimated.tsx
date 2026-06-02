/**
 * SplashAnimated v2 — SmartLíder
 * "O líder aponta, a operação responde."
 *
 * Fix v2:
 *  - Líder movido para ÚLTIMO filho do arena (corrige coluna esquerda sumida no web)
 *  - Centering via wrapper left:0/right:0 (cross-platform seguro)
 *  - Ondas mais sutis
 *  - Núcleo 64dp com ícone maior
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, StyleSheet, Dimensions,
  Animated as RNAnimated,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withRepeat, withSequence, withSpring,
  Easing, interpolate, runOnJS, useAnimatedReaction,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'

// ─── Constants ───────────────────────────────────────────────────────────────

// 'window' retorna viewport no web (screen retorna resolução do monitor)
const { width: SW, height: SH } = Dimensions.get('window')
const GREEN  = '#22C55E'
const BG     = '#0B1A3B'
const CARD_W = Math.min(SW * 0.38, 148)
const BAR_W  = SW - 64

// ─── Statuses ─────────────────────────────────────────────────────────────────

const STATUSES = [
  'Sincronizando apontamentos...',
  'Carregando módulos...',
  'Preparando operação...',
]

// ─── Card data ────────────────────────────────────────────────────────────────

type CardDef = {
  id: string
  title: string
  sub: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  floatAmp: number
  floatDur: number
}

const LEFT_CARDS: CardDef[] = [
  { id: 'mao', title: 'Mão de Obra',   sub: 'Apontar equipe',  icon: 'people-outline',      floatAmp: -5, floatDur: 2200 },
  { id: 'ins', title: 'Insumo',        sub: 'Registrar uso',   icon: 'cube-outline',         floatAmp:  4, floatDur: 2600 },
  { id: 'ref', title: 'Refeição',      sub: 'Solicitar',       icon: 'restaurant-outline',   floatAmp: -4, floatDur: 2400 },
]

const RIGHT_CARDS: CardDef[] = [
  { id: 'maq', title: 'Máquina',       sub: 'Apontar uso',     icon: 'construct-outline',    floatAmp:  5, floatDur: 2000 },
  { id: 'afe', title: 'Aferição',      sub: 'Registrar dados', icon: 'speedometer-outline',  floatAmp: -5, floatDur: 2800 },
  { id: 'pro', title: 'Produtividade', sub: 'Acompanhar',      icon: 'trending-up-outline',  floatAmp:  4, floatDur: 2300 },
]

// ─── Background wave lines ───────────────────────────────────────────────────

function WaveLine({ top, opacity, dur, delay, lineW }: {
  top: number; opacity: number; dur: number; delay: number; lineW: number
}) {
  const x = useRef(new RNAnimated.Value(-lineW)).current
  useEffect(() => {
    const run = () => {
      x.setValue(-lineW)
      RNAnimated.timing(x, { toValue: SW + lineW, duration: dur, delay, useNativeDriver: true }).start(run)
    }
    run()
    return () => x.stopAnimation()
  }, [])
  return (
    <RNAnimated.View style={{
      position: 'absolute', left: 0, top,
      width: lineW, height: 1,
      backgroundColor: `rgba(34,197,94,${opacity})`,
      transform: [{ translateX: x }],
    }} />
  )
}

const WAVES = [
  { top: SH * 0.20, opacity: 0.10, dur: 4200, delay:   0, lineW: SW * 1.4 },
  { top: SH * 0.38, opacity: 0.07, dur: 5800, delay: 600, lineW: SW * 1.2 },
  { top: SH * 0.55, opacity: 0.12, dur: 3600, delay: 200, lineW: SW * 1.6 },
  { top: SH * 0.70, opacity: 0.08, dur: 6200, delay: 800, lineW: SW * 1.3 },
  { top: SH * 0.85, opacity: 0.09, dur: 4800, delay: 400, lineW: SW * 1.1 },
]

// ─── NucleusCore ─────────────────────────────────────────────────────────────

function NucleusCore({ pulseSV }: { pulseSV: Animated.SharedValue<number> }) {
  const ring1 = useSharedValue(0)
  const ring2 = useSharedValue(0)
  const spin  = useSharedValue(0)
  const glow  = useSharedValue(0)

  useEffect(() => {
    ring1.value = withDelay(800, withRepeat(withSequence(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 0 }),
    ), -1))
    ring2.value = withDelay(1500, withRepeat(withSequence(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 0 }),
    ), -1))
    spin.value = withRepeat(withTiming(360, { duration: 10000, easing: Easing.linear }), -1)
  }, [])

  useAnimatedReaction(
    () => pulseSV.value,
    (cur, prev) => {
      if (cur > 0.5 && (!prev || prev < 0.5)) {
        glow.value = withSequence(withTiming(1, { duration: 240 }), withTiming(0, { duration: 580 }))
      }
    },
  )

  const r1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.3, 1], [0.35, 0.55, 0]) + glow.value * 0.5,
    transform: [{ scale: 1 + ring1.value * 1.3 + glow.value * 0.4 }],
  }))
  const r2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.3, 1], [0.2, 0.35, 0]),
    transform: [{ scale: 1 + ring2.value * 2.1 }],
  }))
  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 2 }],
  }))
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }))

  return (
    <View style={nc.wrap}>
      <Animated.View style={[nc.ring, r2Style]} />
      <Animated.View style={[nc.ring, r1Style]} />
      <Animated.View style={[nc.ring, nc.glowRing, glowRingStyle]} />
      <View style={nc.core}>
        <Animated.View style={spinStyle}>
          <Ionicons name="stats-chart" size={26} color={GREEN} />
        </Animated.View>
      </View>
    </View>
  )
}

const nc = StyleSheet.create({
  wrap:     { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', zIndex: 8 },
  ring:     { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.45)' },
  glowRing: { borderColor: GREEN, borderWidth: 2 },
  core:     {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: GREEN,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
})

// ─── FloatingCard ─────────────────────────────────────────────────────────────

function FloatingCard({ title, sub, icon, floatAmp, floatDur, delay, pulseSV }: CardDef & {
  delay: number; pulseSV: Animated.SharedValue<number>
}) {
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(Math.abs(floatAmp))
  const glowVal    = useSharedValue(0)

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 380 }))
    translateY.value = withDelay(delay + 280, withRepeat(
      withSequence(
        withTiming( floatAmp, { duration: floatDur / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(-floatAmp, { duration: floatDur / 2, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    ))
  }, [])

  useAnimatedReaction(
    () => pulseSV.value,
    (cur, prev) => {
      if (cur > 0.5 && (!prev || prev < 0.5)) {
        glowVal.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 450 }))
      }
    },
  )

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    borderColor: `rgba(34,197,94,${0.2 + glowVal.value * 0.7})`,
  }))

  const iconBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(34,197,94,${0.1 + glowVal.value * 0.2})`,
  }))

  return (
    <Animated.View style={[fc.card, cardStyle]}>
      <View style={fc.row}>
        <Animated.View style={[fc.iconWrap, iconBgStyle]}>
          <Ionicons name={icon} size={14} color={GREEN} />
        </Animated.View>
        <View style={fc.texts}>
          <Text style={fc.title} numberOfLines={1}>{title}</Text>
          <Text style={fc.sub} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
    </Animated.View>
  )
}

const fc = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: 'rgba(8,18,38,0.90)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    marginBottom: 8,
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  texts:    { flex: 1 },
  title:    { color: '#e8f0f8', fontSize: 11.5, fontWeight: '700' },
  sub:      { color: '#3a5572', fontSize: 9.5, marginTop: 1 },
})

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progressSV }: { progressSV: Animated.SharedValue<number> }) {
  const shimX = useRef(new RNAnimated.Value(-50)).current
  useEffect(() => {
    RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(shimX, { toValue: BAR_W + 50, duration: 1100, delay: 150, useNativeDriver: true }),
      RNAnimated.timing(shimX, { toValue: -50, duration: 0, useNativeDriver: true }),
    ])).start()
    return () => shimX.stopAnimation()
  }, [])
  const fillStyle = useAnimatedStyle(() => ({ width: BAR_W * progressSV.value }))
  return (
    <View style={pb.bg}>
      <Animated.View style={[pb.fill, fillStyle]} />
      <RNAnimated.View style={[pb.shimmer, { transform: [{ translateX: shimX }] }]} />
    </View>
  )
}

const pb = StyleSheet.create({
  bg:      { width: BAR_W, height: 3, backgroundColor: '#081422', borderRadius: 2, overflow: 'hidden' },
  fill:    { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: GREEN, borderRadius: 2 },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 50, backgroundColor: 'rgba(34,197,94,0.45)', borderRadius: 2 },
})

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SplashAnimated({ onFinish }: { onFinish: () => void }) {
  const [statusIdx, setStatusIdx] = useState(0)

  const headerOp    = useSharedValue(0)
  const headerY     = useSharedValue(-22)
  const leaderOp    = useSharedValue(0)
  const leaderScale = useSharedValue(0.92)
  const pulseSV     = useSharedValue(0)
  const progressW   = useSharedValue(0)
  const footerOp    = useSharedValue(0)
  const screenOp    = useSharedValue(1)
  const statusOp    = useSharedValue(1)

  const changeStatus = (idx: number) => setStatusIdx(idx)

  useEffect(() => {
    headerOp.value = withTiming(1, { duration: 420 })
    headerY.value  = withSpring(0, { damping: 16, stiffness: 110 })

    leaderOp.value    = withDelay(150, withTiming(1, { duration: 550 }))
    leaderScale.value = withDelay(150, withSpring(1, { damping: 18, stiffness: 100 }))

    setTimeout(() => {
      pulseSV.value = withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 540 }))
    }, 1000)

    progressW.value = withDelay(1500, withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }))

    const crossFade = (idx: number) => {
      statusOp.value = withSequence(withTiming(0, { duration: 130 }), withTiming(1, { duration: 180 }))
      setTimeout(() => runOnJS(changeStatus)(idx), 130)
    }
    setTimeout(() => crossFade(0), 1500)
    setTimeout(() => crossFade(1), 1950)
    setTimeout(() => crossFade(2), 2250)

    footerOp.value = withDelay(2100, withTiming(1, { duration: 320 }))

    setTimeout(() => {
      screenOp.value = withTiming(0, { duration: 280 }, () => runOnJS(onFinish)())
    }, 2500)
  }, [])

  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOp.value, transform: [{ translateY: headerY.value }] }))
  const leaderStyle = useAnimatedStyle(() => ({ opacity: leaderOp.value, transform: [{ scale: leaderScale.value }] }))
  const footerStyle = useAnimatedStyle(() => ({ opacity: footerOp.value }))
  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOp.value }))
  const statusStyle = useAnimatedStyle(() => ({ opacity: statusOp.value }))

  return (
    <Animated.View style={[sa.root, screenStyle]}>

      {/* Ondas de fundo */}
      {WAVES.map((w, i) => (
        <WaveLine key={i} top={w.top} opacity={w.opacity} dur={w.dur} delay={w.delay} lineW={w.lineW} />
      ))}

      {/* Header */}
      <Animated.View style={[sa.header, headerStyle]}>
        <View style={sa.brandRow}>
          <View style={sa.brandCircle}>
            <Ionicons name="stats-chart" size={11} color={GREEN} />
          </View>
          <Text style={sa.brandTxt}>
            <Text style={sa.w}>Smart</Text><Text style={sa.g}>Pro</Text>
          </Text>
        </View>
        <Text style={sa.titleTxt}>
          <Text style={sa.titleW}>Smart</Text><Text style={sa.titleG}>Líder</Text>
        </Text>
        <Text style={sa.tagline}>GESTÃO OPERACIONAL INTELIGENTE</Text>
      </Animated.View>

      {/* Arena ─────────────────────────────────────────────────────────────────
          Líder como ÚLTIMO filho (absolute) → não quebra o layout flex.
          Wrapper left:0/right:0 + alignItems:'center' → centragem cross-platform. */}
      <View style={sa.arena}>

        {/* Coluna esquerda */}
        <View style={sa.col}>
          {LEFT_CARDS.map((c, i) => (
            <FloatingCard key={c.id} {...c} delay={[400, 520, 640][i]} pulseSV={pulseSV} />
          ))}
        </View>

        {/* Núcleo */}
        <View style={sa.centerCol}>
          <NucleusCore pulseSV={pulseSV} />
        </View>

        {/* Coluna direita */}
        <View style={sa.col}>
          {RIGHT_CARDS.map((c, i) => (
            <FloatingCard key={c.id} {...c} delay={[460, 580, 700][i]} pulseSV={pulseSV} />
          ))}
        </View>

        {/* Líder — SEMPRE ÚLTIMO: não interfere no flex, centra cross-platform */}
        <View style={sa.leaderCentering} pointerEvents="none">
          {/* plain View com bgColor → Animated.View reanimated cria GPU layer transparente no web */}
          <View style={sa.leaderSizer}>
            <Animated.View style={[StyleSheet.absoluteFillObject, leaderStyle]}>
              <Image
                source={require('../../../assets/lider.png')}
                style={sa.leaderImg}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
        </View>

      </View>

      {/* Progress + status */}
      <View style={sa.progressArea}>
        <Animated.Text style={[sa.statusTxt, statusStyle]}>
          {STATUSES[statusIdx]}
        </Animated.Text>
        <ProgressBar progressSV={progressW} />
      </View>

      {/* Footer */}
      <Animated.View style={[sa.footer, footerStyle]}>
        <Ionicons name="globe-outline" size={12} color={GREEN} />
        <Text style={sa.footerTxt}>
          Operação conectada à <Text style={sa.footerBrand}>SmartPro</Text>
        </Text>
      </Animated.View>

    </Animated.View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ARENA_H = SH - (SH < 700 ? 230 : 270)

const sa = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, overflow: 'hidden' },

  header: {
    alignItems: 'center',
    paddingTop: SH < 700 ? 32 : 44,
    paddingBottom: 6,
    zIndex: 10,
  },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  brandCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  brandTxt:    { fontSize: 13, fontWeight: '700' },
  w:           { color: '#ffffff' },
  g:           { color: GREEN },
  titleTxt:    { fontSize: SH < 700 ? 40 : 48, fontWeight: '900', letterSpacing: -1, lineHeight: SH < 700 ? 44 : 52, marginBottom: 4 },
  titleW:      { color: '#ffffff' },
  titleG:      { color: GREEN },
  tagline:     { color: '#2a4060', fontSize: 10, fontWeight: '700', letterSpacing: 3.5 },

  arena: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',    // colunas ocupam altura total da arena
    paddingHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end', // cards na parte inferior da arena (à altura do torso do líder)
    paddingBottom: 24,
    zIndex: 5,
  },
  centerCol: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'flex-end', // núcleo alinhado com os cards
    paddingBottom: 24 + 154/2 - 32, // alinha núcleo ao meio vertical dos 3 cards (~77px)
    zIndex: 8,
  },

  // Wrapper que cobre todo o arena e centraliza o líder horizontalmente
  leaderCentering: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    backgroundColor: BG, // garante que transparência da imagem mostra o fundo correto (web+native)
  },
  leaderSizer: {
    width: SW * 0.72,
    height: ARENA_H * 0.90,
  },
  leaderImg: { width: '100%', height: '100%' },

  progressArea: {
    paddingHorizontal: 32,
    paddingBottom: 10,
    alignItems: 'center',
    zIndex: 10,
  },
  statusTxt: { color: '#2e4560', fontSize: 11, marginBottom: 8, letterSpacing: 0.2, textAlign: 'center' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: SH < 700 ? 22 : 30,
    zIndex: 10,
  },
  footerTxt:   { color: '#2e4560', fontSize: 12 },
  footerBrand: { color: GREEN, fontWeight: '700' },
})
