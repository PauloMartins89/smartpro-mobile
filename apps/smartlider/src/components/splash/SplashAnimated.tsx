/**
 * SplashAnimated — SmartLíder
 * "O líder aponta, a operação responde."
 *
 * Timeline:
 *   0.0s  Header + leader fade-in + background waves
 *   0.4s  Cards surgem em stagger + nucleus idle pulse
 *   1.0s  Toque no tablet → nucleus glow + cards brilham
 *   1.5s  Barra de progresso avança + status alterna
 *   2.1s  Footer aparece
 *   2.5s  Fade-out → onFinish()
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

const { width: SW, height: SH } = Dimensions.get('screen')
const GREEN  = '#22C55E'
const BG     = '#0B1A3B'
const BAR_W  = SW - 64          // barra de progresso: tela - padding

// ─── Status texts ─────────────────────────────────────────────────────────────

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
  { id: 'mao', title: 'Mão de Obra',   sub: 'Apontar equipe',  icon: 'people-outline',         floatAmp: -5, floatDur: 2200 },
  { id: 'ins', title: 'Insumo',        sub: 'Registrar uso',   icon: 'cube-outline',            floatAmp:  4, floatDur: 2600 },
  { id: 'ref', title: 'Refeição',      sub: 'Solicitar',       icon: 'restaurant-outline',      floatAmp: -4, floatDur: 2400 },
]

const RIGHT_CARDS: CardDef[] = [
  { id: 'maq', title: 'Máquina',       sub: 'Apontar uso',     icon: 'construct-outline',       floatAmp:  5, floatDur: 2000 },
  { id: 'afe', title: 'Aferição',      sub: 'Registrar dados', icon: 'speedometer-outline',     floatAmp: -5, floatDur: 2800 },
  { id: 'pro', title: 'Produtividade', sub: 'Acompanhar',      icon: 'trending-up-outline',     floatAmp:  4, floatDur: 2300 },
]

// ─── AnimatedBackground — horizontal data-flow lines ─────────────────────────

function WaveLine({ top, opacity, dur, delay, lineW }: {
  top: number; opacity: number; dur: number; delay: number; lineW: number
}) {
  const x = useRef(new RNAnimated.Value(-lineW)).current
  useEffect(() => {
    const run = () => {
      x.setValue(-lineW)
      RNAnimated.timing(x, {
        toValue: SW + lineW, duration: dur, delay, useNativeDriver: true,
      }).start(run)
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

const WAVE_CONFIG = [
  { top: SH * 0.10, opacity: 0.055, dur: 4200, delay:   0, lineW: SW * 1.4 },
  { top: SH * 0.24, opacity: 0.040, dur: 5800, delay: 600, lineW: SW * 1.2 },
  { top: SH * 0.38, opacity: 0.065, dur: 3600, delay: 200, lineW: SW * 1.6 },
  { top: SH * 0.53, opacity: 0.045, dur: 6200, delay: 800, lineW: SW * 1.3 },
  { top: SH * 0.67, opacity: 0.035, dur: 4800, delay: 400, lineW: SW * 1.1 },
  { top: SH * 0.80, opacity: 0.050, dur: 5100, delay: 100, lineW: SW * 1.5 },
  { top: SH * 0.91, opacity: 0.040, dur: 3900, delay: 300, lineW: SW * 1.7 },
]

// ─── NucleusCore — ícone central com pulso ────────────────────────────────────

function NucleusCore({ pulseSV }: { pulseSV: Animated.SharedValue<number> }) {
  const ring1 = useSharedValue(0)
  const ring2 = useSharedValue(0)
  const spin  = useSharedValue(0)
  const glow  = useSharedValue(0)

  useEffect(() => {
    // Idle pulse rings (início suave após cards aparecerem)
    ring1.value = withDelay(800, withRepeat(withSequence(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 0 }),
    ), -1))
    ring2.value = withDelay(1500, withRepeat(withSequence(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 0 }),
    ), -1))
    // Slow spin no ícone interno
    spin.value = withRepeat(
      withTiming(360, { duration: 10000, easing: Easing.linear }), -1,
    )
  }, [])

  // Reage ao toque do tablet
  useAnimatedReaction(
    () => pulseSV.value,
    (cur, prev) => {
      if (cur > 0.5 && (!prev || prev < 0.5)) {
        glow.value = withSequence(
          withTiming(1, { duration: 240 }),
          withTiming(0, { duration: 580 }),
        )
      }
    },
  )

  const r1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.3, 1], [0.35, 0.55, 0])
           + glow.value * 0.6,
    transform: [{ scale: 1 + ring1.value * 1.3 + glow.value * 0.5 }],
  }))
  const r2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.3, 1], [0.2, 0.35, 0]),
    transform: [{ scale: 1 + ring2.value * 2.1 }],
  }))
  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 1.0,
    transform: [{ scale: 1 + glow.value * 2.2 }],
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
          <Ionicons name="stats-chart" size={22} color={GREEN} />
        </Animated.View>
      </View>
    </View>
  )
}

const nc = StyleSheet.create({
  wrap:     { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  ring:     { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.45)' },
  glowRing: { borderColor: GREEN, borderWidth: 2 },
  core:     {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: GREEN,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
  },
})

// ─── FloatingCard ─────────────────────────────────────────────────────────────

function FloatingCard({ title, sub, icon, floatAmp, floatDur, delay, pulseSV }: CardDef & {
  delay: number; pulseSV: Animated.SharedValue<number>
}) {
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(floatAmp > 0 ? floatAmp : -floatAmp)
  const glowVal    = useSharedValue(0)

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 380 }))
    translateY.value = withDelay(delay + 280,
      withRepeat(
        withSequence(
          withTiming( floatAmp, { duration: floatDur / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(-floatAmp, { duration: floatDur / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      ),
    )
  }, [])

  useAnimatedReaction(
    () => pulseSV.value,
    (cur, prev) => {
      if (cur > 0.5 && (!prev || prev < 0.5)) {
        glowVal.value = withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 450 }),
        )
      }
    },
  )

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    borderColor: `rgba(34,197,94,${0.18 + glowVal.value * 0.72})`,
  }))

  const iconBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(34,197,94,${0.10 + glowVal.value * 0.20})`,
  }))

  return (
    <Animated.View style={[fcard.card, cardStyle]}>
      <View style={fcard.row}>
        <Animated.View style={[fcard.iconWrap, iconBgStyle]}>
          <Ionicons name={icon} size={13} color={GREEN} />
        </Animated.View>
        <View style={fcard.texts}>
          <Text style={fcard.title} numberOfLines={1}>{title}</Text>
          <Text style={fcard.sub} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
    </Animated.View>
  )
}

const fcard = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(8,18,38,0.88)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 8,
    width: SW * 0.39,
    marginBottom: 8,
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  texts:    { flex: 1 },
  title:    { color: '#e8f0f8', fontSize: 11, fontWeight: '700' },
  sub:      { color: '#3a5572', fontSize: 9, marginTop: 1 },
})

// ─── ProgressBar com shimmer ──────────────────────────────────────────────────

function ProgressBar({ progressSV }: { progressSV: Animated.SharedValue<number> }) {
  const shimX = useRef(new RNAnimated.Value(-50)).current

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimX, { toValue: BAR_W + 50, duration: 1200, delay: 200, useNativeDriver: true }),
        RNAnimated.timing(shimX, { toValue: -50, duration: 0, useNativeDriver: true }),
      ]),
    ).start()
    return () => shimX.stopAnimation()
  }, [])

  const fillStyle = useAnimatedStyle(() => ({
    width: BAR_W * progressSV.value,
  }))

  return (
    <View style={pb.bg}>
      <Animated.View style={[pb.fill, fillStyle]} />
      <RNAnimated.View style={[pb.shimmer, { transform: [{ translateX: shimX }] }]} />
    </View>
  )
}

const pb = StyleSheet.create({
  bg:      { width: BAR_W, height: 3, backgroundColor: '#081422', borderRadius: 2, overflow: 'hidden' },
  fill:    { position: 'absolute', left: 0, top: 0, height: '100%', backgroundColor: GREEN, borderRadius: 2 },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 50, backgroundColor: 'rgba(34,197,94,0.45)', borderRadius: 2 },
})

// ─── Main SplashAnimated ──────────────────────────────────────────────────────

export default function SplashAnimated({ onFinish }: { onFinish: () => void }) {
  const [statusIdx, setStatusIdx] = useState(0)

  const headerOp    = useSharedValue(0)
  const headerY     = useSharedValue(-18)
  const leaderOp    = useSharedValue(0)
  const leaderScale = useSharedValue(0.93)
  const pulseSV     = useSharedValue(0)
  const progressW   = useSharedValue(0)
  const footerOp    = useSharedValue(0)
  const screenOp    = useSharedValue(1)
  const statusOp    = useSharedValue(1)

  const changeStatus = (idx: number) => setStatusIdx(idx)

  useEffect(() => {
    // ── 0.0s: Header desliza de cima ───────────────────────────────────────
    headerOp.value = withTiming(1, { duration: 420 })
    headerY.value  = withSpring(0, { damping: 16, stiffness: 110 })

    // ── 0.2s: Líder fade + leve escala ────────────────────────────────────
    leaderOp.value    = withDelay(180, withTiming(1, { duration: 520 }))
    leaderScale.value = withDelay(180, withSpring(1, { damping: 18, stiffness: 100 }))

    // ── 1.0s: Toque no tablet — pulse geral ───────────────────────────────
    setTimeout(() => {
      pulseSV.value = withSequence(
        withTiming(1, { duration: 260 }),
        withTiming(0, { duration: 540 }),
      )
    }, 1000)

    // ── 1.5s: Progresso avança até 100% ───────────────────────────────────
    progressW.value = withDelay(1500,
      withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }),
    )

    // ── Status text alternando com cross-fade ─────────────────────────────
    const crossFade = (idx: number) => {
      statusOp.value = withSequence(
        withTiming(0, { duration: 130 }),
        withTiming(1, { duration: 180 }),
      )
      setTimeout(() => runOnJS(changeStatus)(idx), 130)
    }
    setTimeout(() => crossFade(0), 1500)
    setTimeout(() => crossFade(1), 1950)
    setTimeout(() => crossFade(2), 2250)

    // ── 2.1s: Rodapé ──────────────────────────────────────────────────────
    footerOp.value = withDelay(2100, withTiming(1, { duration: 320 }))

    // ── 2.5s: Fade-out → onFinish ─────────────────────────────────────────
    setTimeout(() => {
      screenOp.value = withTiming(0, { duration: 280 }, () => {
        runOnJS(onFinish)()
      })
    }, 2500)
  }, [])

  const headerStyle   = useAnimatedStyle(() => ({
    opacity:   headerOp.value,
    transform: [{ translateY: headerY.value }],
  }))
  const leaderStyle   = useAnimatedStyle(() => ({
    opacity:   leaderOp.value,
    transform: [{ scale: leaderScale.value }],
  }))
  const footerStyle   = useAnimatedStyle(() => ({ opacity: footerOp.value }))
  const screenStyle   = useAnimatedStyle(() => ({ opacity: screenOp.value }))
  const statusStyle   = useAnimatedStyle(() => ({ opacity: statusOp.value }))

  const CARD_DELAY_L = [400, 520, 640]
  const CARD_DELAY_R = [460, 580, 700]

  return (
    <Animated.View style={[sa.root, screenStyle]}>

      {/* ── Fundo: ondas de dados ─────────────────────────────────────── */}
      {WAVE_CONFIG.map((w, i) => (
        <WaveLine key={i} top={w.top} opacity={w.opacity} dur={w.dur} delay={w.delay} lineW={w.lineW} />
      ))}

      {/* ── Header: SmartPro + SmartLíder + tagline ───────────────────── */}
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

      {/* ── Arena: cards + núcleo + líder ─────────────────────────────── */}
      <View style={sa.arena}>

        {/* Personagem líder — camada de fundo absoluta ───────────────── */}
        <Animated.View style={[sa.leaderAbsolute, leaderStyle]}>
          <Image
            source={require('../../../assets/lider.jpeg')}
            style={sa.leaderImg}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Coluna esquerda ────────────────────────────────────────────── */}
        <View style={sa.col}>
          {LEFT_CARDS.map((c, i) => (
            <FloatingCard
              key={c.id} {...c}
              delay={CARD_DELAY_L[i]}
              pulseSV={pulseSV}
            />
          ))}
        </View>

        {/* Centro: núcleo ─────────────────────────────────────────────── */}
        <View style={sa.centerCol}>
          <NucleusCore pulseSV={pulseSV} />
        </View>

        {/* Coluna direita ─────────────────────────────────────────────── */}
        <View style={sa.col}>
          {RIGHT_CARDS.map((c, i) => (
            <FloatingCard
              key={c.id} {...c}
              delay={CARD_DELAY_R[i]}
              pulseSV={pulseSV}
            />
          ))}
        </View>

      </View>

      {/* ── Barra de progresso + status ───────────────────────────────── */}
      <View style={sa.progressArea}>
        <Animated.Text style={[sa.statusTxt, statusStyle]}>
          {STATUSES[statusIdx]}
        </Animated.Text>
        <ProgressBar progressSV={progressW} />
      </View>

      {/* ── Rodapé ────────────────────────────────────────────────────── */}
      <Animated.View style={[sa.footer, footerStyle]}>
        <Ionicons name="globe-outline" size={12} color={GREEN} />
        <Text style={sa.footerTxt}>
          Operação conectada à{' '}
          <Text style={sa.footerBrand}>SmartPro</Text>
        </Text>
      </Animated.View>

    </Animated.View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sa = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: BG, overflow: 'hidden',
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: SH < 700 ? 36 : 48,
    paddingBottom: 8,
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  brandCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
  },
  brandTxt: { fontSize: 13, fontWeight: '700' },
  w: { color: '#fff' },
  g: { color: GREEN },
  titleTxt: {
    fontSize: SH < 700 ? 42 : 50,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: SH < 700 ? 46 : 54,
    marginBottom: 6,
  },
  titleW: { color: '#ffffff' },
  titleG: { color: GREEN },
  tagline: {
    color: '#2a4060', fontSize: 10, fontWeight: '700', letterSpacing: 3.5,
  },

  // Arena
  arena: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    position: 'relative',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    zIndex: 5,
  },
  centerCol: {
    width: 66,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },

  // Líder character — absolute, behind the cards
  leaderAbsolute: {
    position: 'absolute',
    bottom: -SH * 0.02,
    alignSelf: 'center',
    width: SW * 0.58,
    height: SH * 0.42,
    zIndex: 2,
  },
  leaderImg: {
    width: '100%',
    height: '100%',
  },

  // Progress area
  progressArea: {
    paddingHorizontal: 32,
    paddingBottom: 10,
    alignItems: 'center',
    zIndex: 10,
  },
  statusTxt: {
    color: '#2e4560',
    fontSize: 11,
    marginBottom: 8,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: SH < 700 ? 24 : 32,
    zIndex: 10,
  },
  footerTxt: { color: '#2e4560', fontSize: 12 },
  footerBrand: { color: GREEN, fontWeight: '700' },
})
