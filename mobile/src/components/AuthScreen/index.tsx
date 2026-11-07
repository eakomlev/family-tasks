import type { ReactNode } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { useEffect } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { AppLogo } from '../AppLogo'

// Фон и колонка экранов входа: градиент «Квеста» на весь экран, логотип и контент поверх
export function AuthScreen({ children, showLogo = true, welcome = false }: { children: ReactNode; showLogo?: boolean; welcome?: boolean }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const drift = useSharedValue(0)

  useEffect(() => {
    if (!welcome) return
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [drift, welcome])

  const orbitTransform = useAnimatedStyle(() => ({
    transform: [
      { translateX: -14 + drift.value * 28 },
      { translateY: 10 - drift.value * 20 },
    ],
  }))
  return (
    <LinearGradient colors={welcome ? ['#171651', '#10152f', '#080b19'] : [colors.authA, colors.authB, colors.authC]} style={{ flex: 1 }}>
      {welcome && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
          <Animated.View style={[StyleSheet.absoluteFill, orbitTransform]}>
            <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
              <Defs>
                <RadialGradient id="glowViolet" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor="#bda6ff" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#9b75ff" stopOpacity="0" />
                </RadialGradient>
                <RadialGradient id="glowGold" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor="#fff4ca" stopOpacity="1" />
                  <Stop offset="45%" stopColor="#ffc27c" stopOpacity="0.95" />
                  <Stop offset="100%" stopColor="#ff9f72" stopOpacity="0" />
                </RadialGradient>
                <SvgLinearGradient id="horizon" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#8d67ff" stopOpacity="0" />
                  <Stop offset="48%" stopColor="#c09aff" stopOpacity="0.9" />
                  <Stop offset="100%" stopColor="#8062ff" stopOpacity="0" />
                </SvgLinearGradient>
                <SvgLinearGradient id="wave" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#ad72ff" stopOpacity="0.34" />
                  <Stop offset="100%" stopColor="#5634c8" stopOpacity="0.02" />
                </SvgLinearGradient>
              </Defs>
              <Path d="M-28 435 C70 354 135 326 197 332 C281 340 341 381 424 278" fill="none" stroke="#9e81ff" strokeOpacity="0.53" strokeWidth="1.2" />
              <Path d="M-32 476 C58 547 129 568 193 529 C267 484 314 397 414 365" fill="none" stroke="#ad8cff" strokeOpacity="0.52" strokeWidth="1.2" />
              <Path d="M-20 554 C71 601 148 617 220 579 C292 542 344 481 413 458" fill="none" stroke="url(#horizon)" strokeOpacity="0.72" strokeWidth="1.1" />
              <Path d="M-20 632 C82 580 133 608 211 637 C292 668 341 623 410 585 L410 844 L-20 844 Z" fill="url(#wave)" />
              <Path d="M-20 661 C69 619 129 636 203 662 C283 690 342 656 410 620" fill="none" stroke="#bd8cff" strokeOpacity="0.7" strokeWidth="1.3" />
              <Circle cx="311" cy="314" r="14" fill="url(#glowGold)" />
              <Circle cx="311" cy="314" r="4.8" fill="#fff1c6" />
              <Circle cx="196" cy="355" r="12" fill="url(#glowViolet)" />
              <Circle cx="196" cy="355" r="3.5" fill="#bba0ff" />
              <Circle cx="325" cy="510" r="15" fill="url(#glowGold)" />
              <Circle cx="325" cy="510" r="5" fill="#ffe0aa" />
              <Circle cx="112" cy="569" r="15" fill="url(#glowGold)" />
              <Circle cx="112" cy="569" r="5" fill="#ffe4b2" />
              <Circle cx="145" cy="363" r="2" fill="#aa8aff" opacity="0.75" />
              <Circle cx="84" cy="502" r="1.7" fill="#c6a6ff" opacity="0.65" />
            </Svg>
          </Animated.View>
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, gap: 20, paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        >
          {showLogo && (
            <View style={{ alignItems: 'flex-start' }}>
              <AppLogo />
            </View>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}
