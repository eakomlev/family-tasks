import { CoinIcon } from '@/components/CoinBalance'
import { useLongPress } from '../../useLongPress'
import { formatMessageTime, groupReactions, totalCoins } from '../../utils'
import { Bubble, CoinPill, Extras, Footer, ReactionChip, Sender, Text, Tick, Time, Wrap } from './styles'
import type { MessageBubbleProps } from './types'

export function MessageBubble({ message, mine, senderName, senderMood, showSender, status, onFeedback }: MessageBubbleProps) {
  const reactions = groupReactions(message.reactions)
  const coins = totalCoins(message.awards)

  const press = useLongPress(onFeedback)

  // долгое нажатие (палец), удержание мыши или правая кнопка открывают окно реакции; с клавиатуры Enter и пробел
  const interactive = onFeedback
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-haspopup': 'dialog' as const,
        title: 'Удерживайте, чтобы поставить реакцию',
        ...press,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFeedback()
          }
        },
      }
    : {}

  return (
    <Wrap $mine={mine}>
      <Bubble $mine={mine} $interactive={!!onFeedback} {...interactive}>
        {showSender && !mine && <Sender>{senderName ?? 'Участник'}{senderMood && <span aria-hidden> {senderMood}</span>}</Sender>}
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
      {(reactions.length > 0 || coins > 0) && (
        <Extras $mine={mine} aria-label="Реакции и монеты">
          {reactions.map((r) => (
            <ReactionChip key={r.emoji} aria-label={`Реакция ${r.emoji}${r.count > 1 ? `, ${r.count}` : ''}`}>
              <span aria-hidden>{r.emoji}</span>
              {r.count > 1 && <small>{r.count}</small>}
            </ReactionChip>
          ))}
          {coins > 0 && (
            <CoinPill aria-label={`Начислено монет: ${coins}`}>
              <CoinIcon />
              <span>+{coins}</span>
            </CoinPill>
          )}
        </Extras>
      )}
    </Wrap>
  )
}
