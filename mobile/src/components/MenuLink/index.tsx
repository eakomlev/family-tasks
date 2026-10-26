import { Pressable } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import styled from 'styled-components/native'
import { Text } from '../Text'

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 16px;
  border-radius: 18px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Пункт меню: название и стрелка, нажатие открывает раздел
export function MenuLink({ to, children }: { to: Href; children: string }) {
  const router = useRouter()
  return (
    <Pressable onPress={() => router.push(to)} accessibilityRole="button">
      <Row>
        <Text $weight="extraBold" style={{ flex: 1 }}>
          {children}
        </Text>
        <Text $tone="muted" $size={20}>
          ›
        </Text>
      </Row>
    </Pressable>
  )
}

// Пункт меню, который не открывает экран приложения, а выполняет действие (например, открывает страницу сайта в браузере)
export function ExternalLink({ onPress, children }: { onPress: () => void; children: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      <Row>
        <Text $weight="extraBold" style={{ flex: 1 }}>
          {children}
        </Text>
        <Text $tone="muted" $size={20}>
          ↗
        </Text>
      </Row>
    </Pressable>
  )
}
