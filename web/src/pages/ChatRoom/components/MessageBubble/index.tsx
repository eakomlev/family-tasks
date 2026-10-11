import { formatMessageTime } from '../../utils'
import { Bubble, Footer, Sender, Text, Tick, Time, Wrap } from './styles'
import type { MessageBubbleProps } from './types'

export function MessageBubble({ message, mine, sender, showSender, status }: MessageBubbleProps) {
  return (
    <Wrap $mine={mine}>
      <Bubble $mine={mine}>
        {showSender && !mine && <Sender>{sender?.name ?? 'Участник'}</Sender>}
        <Text>{message.text}</Text>
        <Footer>
          <Time>{formatMessageTime(message.createdAt)}</Time>
          {mine && status && (
            <Tick $read={status === 'read'} role="img" aria-label={status === 'read' ? 'Прочитано' : 'Отправлено'}>
              <svg viewBox="0 0 20 12" aria-hidden focusable="false">
                {/* одна галочка: отправлено; вторая, сдвинутая, добавляется у прочитанного */}
                <path d="m1.5 6.5 3.2 3.2L11 2.5" />
                {status === 'read' && <path d="m8.5 8.4 1.1 1.3L17.5 2.5" />}
              </svg>
            </Tick>
          )}
        </Footer>
      </Bubble>
    </Wrap>
  )
}
