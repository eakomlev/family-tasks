import { useState } from 'react'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import styled from 'styled-components/native'
import { formatExpiry } from '@/lib/links'
import { Button } from '../Button'
import { Notice } from '../Notice'
import { Stack } from '../Stack'
import { Text } from '../Text'

const Box = styled.View`
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`

// Ссылка-приглашение: показать, скопировать или отправить через меню «Поделиться»
export function LinkBox({ link, expiresAt }: { link: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false)

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
      <Text $size={14} selectable>
        {link}
      </Text>
      <Notice>{`Действует до ${formatExpiry(expiresAt)}`}</Notice>
      <Stack $gap={8}>
        <Button onPress={copy}>{copied ? 'Скопировано' : 'Копировать'}</Button>
        <Button variant="primary" onPress={share}>
          Поделиться
        </Button>
      </Stack>
    </Box>
  )
}
