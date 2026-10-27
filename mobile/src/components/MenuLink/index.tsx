import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, type Href } from 'expo-router'
import styled, { useTheme } from 'styled-components/native'
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

// Пункт меню: название и стрелка, нажатие открывает раздел; необязательный значок слева (имя из Ionicons) на мягкой подложке
export function MenuLink({ to, children, icon }: { to: Href; children: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const router = useRouter()
  const { colors } = useTheme()
  return (
    <Pressable onPress={() => router.push(to)} accessibilityRole="button">
      <Row style={icon ? { gap: 12, paddingVertical: 12 } : undefined}>
        {icon && (
          <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            <Ionicons name={icon} size={20} color={colors.accent} />
          </View>
        )}
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
