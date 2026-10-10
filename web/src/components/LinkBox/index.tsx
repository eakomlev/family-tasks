import { useState } from 'react'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { formatExpiry } from '@/lib/links'
import { Box } from './styles'
import type { LinkBoxProps } from './types'

export function LinkBox({ link, expiresAt }: LinkBoxProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      /* без clipboard ссылку можно выделить и скопировать вручную */
    }
  }

  return (
    <Box>
      <code>{link}</code>
      <Notice $tone="muted">Действует до {formatExpiry(expiresAt)}</Notice>
      <Button type="button" onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</Button>
    </Box>
  )
}
