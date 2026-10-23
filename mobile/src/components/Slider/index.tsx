import { useRef, useState } from 'react'
import { PanResponder, View, type LayoutChangeEvent } from 'react-native'
import { useTheme } from 'styled-components/native'

const THUMB = 28
const TRACK = 6

interface SliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  accessibilityLabel: string
}

// Ползунок: тянется пальцем и нажатием на дорожку, значение кратно шагу. Без нативных модулей.
export function Slider({ value, min, max, step, onChange, accessibilityLabel }: SliderProps) {
  const { colors } = useTheme()
  const [width, setWidth] = useState(0)
  // последние значения нужны жесту, который создаётся один раз
  const latest = useRef({ width: 0, min, max, step, onChange })
  latest.current = { width, min, max, step, onChange }

  const move = (x: number) => {
    const { width: w, min: lo, max: hi, step: st, onChange: emit } = latest.current
    const usable = w - THUMB
    if (usable <= 0) return
    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / usable))
    const raw = lo + ratio * (hi - lo)
    emit(Number((Math.round(raw / st) * st).toFixed(2)))
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // пока палец на ползунке, прокрутка страницы не перехватывает жест
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => move(e.nativeEvent.locationX),
      onPanResponderMove: (e) => move(e.nativeEvent.locationX),
    }),
  ).current

  const ratio = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0
  const left = ratio * Math.max(0, width - THUMB)

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, Number((value + (e.nativeEvent.actionName === 'increment' ? step : -step)).toFixed(2)))))}
      style={{ height: 44, justifyContent: 'center' }}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={{ height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.track }}>
        <View style={{ width: left + THUMB / 2, height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.accent }} />
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.surface, elevation: 3 }}
      />
    </View>
  )
}
