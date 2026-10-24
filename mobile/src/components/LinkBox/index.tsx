import { useEffect, useState } from 'react'
import { Pressable, Share, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import { formatExpiry } from '@/lib/links'
import { Button } from '../Button'
import { Text } from '../Text'

const Box = styled.View`
  gap: 8px;
`

const LinkRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border-radius: 14px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.bg};
`

// Ссылка-приглашение: в одну строку со значком «копировать» справа, ниже срок и кнопка «Поделиться»
export function LinkBox({ link, expiresAt }: { link: string; expiresAt: string }) {
  const { colors } = useTheme()
  const [copied, setCopied] = useState(false)

  // галочка «скопировано» держится недолго и сбрасывается, в том числе при смене ссылки
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  useEffect(() => setCopied(false), [link])

  async function copy() {
    try {
      await Clipboard.setStringAsync(link)
      setCopied(true)
    } catch {
      /* ссылку можно отправить через «Поделиться» */
    }
  }

  async function share() {
    try {
      await Share.share({ message: link })
    } catch {
      /* закрытое меню не ошибка */
    }
  }

  return (
    <Box>
      <LinkRow>
        <Text $size={14} numberOfLines={1} selectable style={{ flex: 1 }}>
          {link}
        </Text>
        <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={copied ? 'Скопировано' : 'Копировать ссылку'} hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={22} color={copied ? colors.success : colors.accent} />
        </Pressable>
      </LinkRow>
      <View style={{ paddingHorizontal: 4 }}>
        <Text $size={13} $tone="muted">{`Действует до ${formatExpiry(expiresAt)}`}</Text>
      </View>
      <Button variant="primary" onPress={share}>
        Поделиться
      </Button>
    </Box>
  )
}
