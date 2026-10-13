import { useRef } from 'react'
import { CoinIcon } from '@/components/CoinBalance'
import { useLongPress } from '../../useLongPress'
import { bubbleText, formatMessageTime, groupReactions, photoColumns, totalCoins } from '../../utils'
import { Bubble, CoinPill, Extras, Footer, PhotoButton, Photos, ReactionChip, Sender, Text, Tick, Time, Wrap } from './styles'
import type { MessageBubbleProps } from './types'

export function MessageBubble({ message, mine, senderName, senderMood, showSender, status, onFeedback, onOpenPhoto }: MessageBubbleProps) {
  const reactions = groupReactions(message.reactions)
  const coins = totalCoins(message.awards)

  // после долгого нажатия палец отпускается над фото и даёт «клик»: просмотр от него открываться не должен
  const lastLong = useRef(0)
  const press = useLongPress(
    onFeedback &&
      (() => {
        lastLong.current = Date.now()
        onFeedback()
      }),
  )
  const photos = message.media ?? []
  const text = bubbleText(message)

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
      <Bubble $mine={mine} $interactive={!!onFeedback} $photoColumns={photos.length > 0 ? photoColumns(photos.length) : undefined} {...interactive}>
        {showSender && !mine && <Sender>{senderName ?? 'Участник'}{senderMood && <span aria-hidden> {senderMood}</span>}</Sender>}
        {photos.length > 0 && (
          <Photos $columns={photoColumns(photos.length)}>
            {photos.map((photo, i) => (
              <PhotoButton
                key={photo.id}
                type="button"
                // одно фото показываем по его пропорциям (не выше предела), несколько квадратными плитками
                $ratio={photos.length === 1 ? Math.max(0.6, photo.width / photo.height) : undefined}
                aria-label={photos.length === 1 ? 'Открыть фото' : `Открыть фото ${i + 1} из ${photos.length}`}
                onClick={() => Date.now() - lastLong.current > 700 && onOpenPhoto?.(i)}
              >
                <img src={photos.length === 1 ? photo.fullUrl : photo.thumbUrl} alt="" width={photo.width} height={photo.height} loading="lazy" draggable={false} />
              </PhotoButton>
            ))}
          </Photos>
        )}
        {text && <Text>{text}</Text>}
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
