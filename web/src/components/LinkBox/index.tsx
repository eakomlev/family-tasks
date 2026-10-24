import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { formatExpiry } from '@/lib/links'
import { Box, CopyButton, Expiry, LinkRow } from './styles'
import type { LinkBoxProps } from './types'

// Ссылка-приглашение: в одну строку со значком «копировать» справа, ниже срок и «Поделиться» (там, где браузер умеет делиться)
export function LinkBox({ link, expiresAt }: LinkBoxProps) {
  // какая ссылка скопирована: у другой ссылки значок снова обычный
  const [copiedLink, setCopiedLink] = useState<string>()
  const copied = copiedLink === link
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // галочка «скопировано» держится недолго
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopiedLink(undefined), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(link)
    } catch {
      /* без clipboard ссылку можно выделить и скопировать вручную */
    }
  }

  async function share() {
    try {
      await navigator.share({ url: link })
    } catch {
      /* закрытое меню не ошибка */
    }
  }

  return (
    <Box>
      <LinkRow>
        <code>{link}</code>
        <CopyButton type="button" $done={copied} aria-label={copied ? 'Скопировано' : 'Копировать ссылку'} title={copied ? 'Скопировано' : 'Копировать'} onClick={copy}>
          {copied ? (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
            </svg>
          )}
        </CopyButton>
      </LinkRow>
      <Expiry>Действует до {formatExpiry(expiresAt)}</Expiry>
      {canShare && (
        <Button $variant="primary" type="button" onClick={share}>
          Поделиться
        </Button>
      )}
    </Box>
  )
}
