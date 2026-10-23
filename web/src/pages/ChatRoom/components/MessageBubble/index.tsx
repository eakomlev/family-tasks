import { useRef, useState } from 'react'
import { CoinIcon } from '@/components/CoinBalance'
import { ReadTicks } from '@/components/ReadTicks'
import { formatFileSize } from '@/lib/files'
import { saveFile } from '@/lib/saveFile'
import { useLongPress } from '../../useLongPress'
import { bubbleText, formatMessageTime, groupReactions, photoColumns, totalCoins } from '../../utils'
import { Bubble, CoinPill, Extras, FileButton, FileInfo, Files, Footer, PhotoButton, Photos, Quote, ReactionChip, Sender, Text, Time, Wrap } from './styles'
import type { MessageBubbleProps } from './types'

export function MessageBubble({ message, mine, senderName, senderMood, showSender, status, onFeedback, onOpenPhoto, replyAuthor }: MessageBubbleProps) {
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
  const files = message.files ?? []
  // какой файл сейчас сохраняется / не сохранился (одно сообщение: пока идёт загрузка, повторное нажатие ничего не делает)
  const [saving, setSaving] = useState<string>()
  const [saveFailed, setSaveFailed] = useState(false)
  async function save(id: string, url: string, name: string) {
    if (saving) return
    setSaving(id)
    setSaveFailed(false)
    try {
      await saveFile(url, name)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(undefined)
    }
  }
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
        {message.replyTo && (
          <Quote aria-label="Ответ на сообщение">
            <strong>{replyAuthor ?? 'Участник'}</strong>
            <span>{message.replyTo.text}</span>
          </Quote>
        )}
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
        {files.length > 0 && (
          <Files>
            {files.map((file) => (
              <FileButton key={file.id} type="button" aria-label={`Скачать файл ${file.name}`} disabled={saving === file.id} onClick={() => Date.now() - lastLong.current > 700 && void save(file.id, file.url, file.name)}>
                <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5" />
                </svg>
                <FileInfo>
                  <strong>{file.name}</strong>
                  <small>{formatFileSize(file.size)}</small>
                </FileInfo>
              </FileButton>
            ))}
            {saveFailed && <Text role="alert">Не удалось сохранить файл.</Text>}
          </Files>
        )}
        {text && <Text>{text}</Text>}
        <Footer>
          <Time>{message.editedAt ? 'изменено ' : ''}{formatMessageTime(message.createdAt)}</Time>
          {mine && status && <ReadTicks status={status} dim />}
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
