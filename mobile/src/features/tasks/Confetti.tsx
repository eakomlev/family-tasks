import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import { buildTrajectories, SAMPLE_SECONDS, TOTAL_SECONDS } from './confettiPhysics'

// Конфетти на весь экран поверх содержимого: залпы снизу и дождь сверху, затем всё стихает само. Нажатиям не мешает.
// При включённом «уменьшении движения» в системе не показывается.
export function Confetti() {
  const { width, height } = useWindowDimensions()
  const time = useRef(new Animated.Value(0)).current
  const [enabled, setEnabled] = useState(false)
  const particles = useMemo(() => buildTrajectories(width, height), [width, height])

  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => alive && setEnabled(!reduce))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    time.setValue(0)
    const animation = Animated.timing(time, { toValue: TOTAL_SECONDS, duration: TOTAL_SECONDS * 1000, easing: Easing.linear, useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [enabled, time])

  if (!enabled) return null
  const input = particles[0].xs.map((_, i) => i * SAMPLE_SECONDS)

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.shape === 'circle' ? p.size : p.size / 2,
            borderRadius: p.shape === 'circle' ? p.size / 2 : 1,
            backgroundColor: p.color,
            opacity: time.interpolate({ inputRange: input, outputRange: p.opacities }),
            transform: [
              { translateX: time.interpolate({ inputRange: input, outputRange: p.xs }) },
              { translateY: time.interpolate({ inputRange: input, outputRange: p.ys }) },
              { rotate: time.interpolate({ inputRange: input, outputRange: p.rotations.map((r) => `${r}rad`) }) },
            ],
          }}
        />
      ))}
    </View>
  )
}
