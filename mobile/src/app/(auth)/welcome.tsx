import { useState } from 'react'
import { Image, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useTheme } from 'styled-components/native'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { openLegal, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'
import { markOnboardingSeen, markOnboardingSkipped, shouldShowOnboarding } from '@/features/onboarding/state'

// Приветствие: слайдер знакомства при первом запуске, затем три действия без обзора функций.
export default function Welcome() {
  const router = useRouter()
  const { colors } = useTheme()
  const [slides, setSlides] = useState(shouldShowOnboarding)

  if (slides) {
    return (
      <LinearGradient colors={[colors.authA, colors.authB, colors.authC]} style={{ flex: 1 }}>
        <Onboarding
          key="first"
          start={0}
          onLast={markOnboardingSeen}
          onSkip={() => {
            markOnboardingSkipped()
            router.push('/login')
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
    <AuthScreen welcome showLogo={false}>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 20 }}>
        <Stack style={{ alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo-mark.png')} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="Логотип Моя Семья" />
        </Stack>
        <Stack $gap={10} style={{ alignItems: 'center', paddingHorizontal: 4 }}>
          <Text $size={42} style={{ color: '#f7f5ff', textAlign: 'center', lineHeight: 50 }}>Моя Семья</Text>
          <Text $size={19} style={{ color: '#c8c1ed', textAlign: 'center', lineHeight: 28 }}>
            Быть ближе и заботиться{ '\n' }о важных вместе
          </Text>
        </Stack>
        <Stack $gap={12}>
          <LinearGradient colors={['#a137ff', '#7d2cf2']} style={{ borderRadius: 999, overflow: 'hidden' }}>
            <Button variant="primary" onPress={() => router.push('/create')} style={{ backgroundColor: 'transparent', minHeight: 56 }}>
              Создать семью
            </Button>
          </LinearGradient>
          <Button variant="secondary" labelColor="#f4f2ff" onPress={() => router.push('/join')} style={{ minHeight: 50, backgroundColor: 'rgba(33,25,91,0.45)', borderColor: 'rgba(224,212,255,0.72)' }}>
            У меня есть приглашение
          </Button>
          <Button variant="text" labelColor="#dfd5ff" onPress={() => router.push('/login')}>
            Уже есть семья? Войти
          </Button>
          <Text $size={12} style={{ textAlign: 'center', color: 'rgba(235,232,255,0.72)', marginTop: 18 }}>
            <Text $size={12} onPress={() => openLegal(PRIVACY_PATH)} accessibilityRole="link" style={{ textDecorationLine: 'underline', color: 'rgba(235,232,255,0.72)' }}>
              Политика обработки данных
            </Text>
            {'  ·  '}
            <Text $size={12} onPress={() => openLegal(TERMS_PATH)} accessibilityRole="link" style={{ textDecorationLine: 'underline', color: 'rgba(235,232,255,0.72)' }}>
              Пользовательское соглашение
            </Text>
          </Text>
        </Stack>
      </View>
    </AuthScreen>
  )
}
