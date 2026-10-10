import { useState } from 'react'
import { formatExpiry } from '../links'

interface Props {
  link: string
  expiresAt: string
}

export function LinkBox({ link, expiresAt }: Props) {
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
    <div className="invite-box">
      <code>{link}</code>
      <span className="muted">Действует до {formatExpiry(expiresAt)}</span>
      <button className="btn" type="button" onClick={copy}>
        {copied ? 'Скопировано' : 'Копировать'}
      </button>
    </div>
  )
}
