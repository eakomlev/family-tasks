import { useEffect, useRef, useState } from 'react'
import { FlatList, Image, Pressable, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { Button } from '@/components/Button'
import { Heading, Text, Title } from '@/components/Text'
import { SLIDES } from './data'

// Слайдер знакомства: пять экранов с настоящими картинками приложения, листаются пальцем или кнопкой «Далее».
// Дошли до последнего и нажали «Начать» (или листали до конца): onDone. «Пропустить» есть на всех слайдах, кроме последнего.
export function Onboarding({ start = 0, onSkip, onDone, onLast }: { start?: number; onSkip: () => void; onDone: () => void; onLast?: () => void }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [index, setIndex] = useState(start)
  const list = useRef<FlatList>(null)
  const last = index === SLIDES.length - 1
  // дошли до последнего слайда: уже можно считать, что знакомство пройдено
  useEffect(() => {
    if (last) onLast?.()
  }, [last, onLast])

  const go = (next: number) => {
    list.current?.scrollToIndex({ index: next, animated: true })
    setIndex(next)
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(slide) => slide.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 24, paddingTop: insets.top + 56, gap: 14, alignItems: 'center' }}>
            <Image source={item.image} accessibilityLabel={item.alt} resizeMode="contain" style={{ width: width - 48, height: Math.min(height * 0.5, 460) }} />
            <Title style={{ textAlign: 'center' }}>{item.title}</Title>
            <Text style={{ textAlign: 'center' }} $tone="muted">
              {item.text}
            </Text>
          </View>
        )}
      />

      {!last && (
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={12} style={{ position: 'absolute', top: insets.top + 12, right: 20 }}>
          <Heading style={{ color: colors.accent }}>Пропустить</Heading>
        </Pressable>
      )}

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityLabel={`Слайд ${index + 1} из ${SLIDES.length}`}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.accent : colors.checkBorder }} />
          ))}
        </View>
        <Button variant="primary" onPress={() => (last ? onDone() : go(index + 1))}>
          {last ? 'Начать' : 'Далее'}
        </Button>
      </View>
    </View>
  )
}
