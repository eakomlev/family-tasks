import { Actions, Bubble, Row, State } from './styles'

export interface PendingMessage {
  key: string
  text: string
  mediaIds: string[]
  fileIds: string[]
  replyTo?: string
  status: 'sending' | 'failed'
}

interface Props {
  items: PendingMessage[]
  onRetry: (key: string) => void
  onRemove: (key: string) => void
}

// Свои сообщения, которые ещё уходят на сервер или не ушли: видны в ленте сразу, при сбое можно повторить или удалить.
export function PendingMessages({ items, onRetry, onRemove }: Props) {
  return (
    <>
      {items.map((item) => (
        <Row key={item.key}>
          <Bubble $failed={item.status === 'failed'}>
            {item.text || (item.mediaIds.length > 0 ? '📷 Фото' : '📎 Файлы')}
            <State role="status">{item.status === 'sending' ? 'Отправляется…' : 'Не отправлено'}</State>
          </Bubble>
          {item.status === 'failed' && (
            <Actions>
              <button type="button" onClick={() => onRetry(item.key)}>Отправить ещё раз</button>
              <button type="button" onClick={() => onRemove(item.key)}>Удалить</button>
            </Actions>
          )}
        </Row>
      ))}
    </>
  )
}
