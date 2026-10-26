import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useTheme } from 'styled-components/native'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { openLegal, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'
import { markOnboardingSeen, markOnboardingSkipped, shouldShowOnboarding } from '@/features/onboarding/state'

// чип и номер слайда, который он открывает
const FEATURES: [string, number][] = [
  ['✅ Задания', 1],
  ['🪙 Монеты', 2],
  ['💬 Чат', 3],
  ['📅 Расписание', 4],
]

// Приветствие для тех, кто ещё не вошёл: при первом запуске слайдер знакомства, затем кнопки «Создать семью», «У меня есть приглашение»,
// «Войти». Чипы с возможностями открывают слайдер на нужном слайде.
export default function Welcome() {
  const router = useRouter()
  const { colors } = useTheme()
  const [slides, setSlides] = useState(shouldShowOnboarding)
  // слайдер открыт повторно по нажатию на чип: номер слайда, «Пропустить» возвращает к кнопкам
  const [reopened, setReopened] = useState<number | null>(null)

  if (slides) {
    return (
      <LinearGradient colors={[colors.authA, colors.authB, colors.authC]} style={{ flex: 1 }}>
        <Onboarding
          key={reopened ?? 'first'}
          start={reopened ?? 0}
          onLast={markOnboardingSeen}
          onSkip={() => {
            if (reopened === null) {
              markOnboardingSkipped()
              router.push('/login')
            }
            setSlides(false)
          }}
          onDone={() => {
            markOnboardingSeen()
            setSlides(false)
          }}
        />
      </LinearGradient>
    )
  }

  return (
    <AuthScreen>
      <Stack $gap={8}>
        <Title>Моя Семья</Title>
        <Text $tone="muted">Задания, награды, расписание и чат: всё, чтобы вся семья была на одной волне.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {FEATURES.map(([label, slide]) => (
            <Pressable
              key={label}
              onPress={() => {
                setReopened(slide)
                setSlides(true)
              }}
              accessibilityRole="button"
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.authCard }}
            >
              <Text $weight="bold" $size={14}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Stack>
      <Stack $gap={8}>
        <Button variant="primary" onPress={() => router.push('/create')}>
          Создать семью
        </Button>
        <Button variant="text" onPress={() => router.push('/join')}>
          У меня есть приглашение
        </Button>
        <Button variant="text" onPress={() => router.push('/login')}>
          Уже есть семья? Войти
        </Button>
        <Text $size={13} $tone="muted" style={{ textAlign: 'center' }}>
          <Text $size={13} $tone="muted" onPress={() => openLegal(PRIVACY_PATH)} accessibilityRole="link" style={{ textDecorationLine: 'underline' }}>
            Политика обработки данных
          </Text>
          {' · '}
          <Text $size={13} $tone="muted" onPress={() => openLegal(TERMS_PATH)} accessibilityRole="link" style={{ textDecorationLine: 'underline' }}>
            Пользовательское соглашение
          </Text>
        </Text>
      </Stack>
    </AuthScreen>
  )
}
