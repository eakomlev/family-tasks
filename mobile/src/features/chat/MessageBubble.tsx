import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import type { ChatMessage } from '@/api'
import { CoinIcon } from '@/components/Coins'
import { Text } from '@/components/Text'
import { formatFileSize } from '@/lib/files'
import { saveRemoteFile } from '@/lib/saveFile'
import { ReadTicks } from './ReadTicks'
import { bubbleText, formatMessageTime, groupReactions, photoColumns, totalCoins, type MessageStatus } from './roomUtils'

const Bubble = styled.View<{ $mine: boolean }>`
  max-width: 82%;
  padding: 8px 12px 6px;
  border-radius: 18px;
  border-bottom-right-radius: ${({ $mine }) => ($mine ? 6 : 18)}px;
  border-bottom-left-radius: ${({ $mine }) => ($mine ? 18 : 6)}px;
  background-color: ${({ theme, $mine }) => ($mine ? theme.colors.accent : theme.colors.surface)};
  border-width: ${({ $mine }) => ($mine ? 0 : 1)}px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
`

const Chip = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.bg};
  background-color: ${({ theme }) => theme.colors.surface};
`

interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  senderName?: string
  // смайлик сегодняшнего настроения автора (в общем чате)
  senderMood?: string
  // имя автора над чужим сообщением (в общем чате)
  showSender: boolean
  status?: MessageStatus
  // долгое нажатие открывает окно реакции и монет
  onFeedback?: () => void
  // нажатие на фото: номер фото в сообщении
  onOpenPhoto?: (index: number) => void
}

// Ширина пузыря с вложениями: фиксированная, иначе плитки фото вылезают за него
const PHOTO_WIDTH = 240

// Пузырь сообщения: свои справа акцентные, чужие слева; внутри фото (плитками) и файлы, под ним реакции и начисленные монеты
export function MessageBubble({ message, mine, senderName, senderMood, showSender, status, onFeedback, onOpenPhoto }: MessageBubbleProps) {
  const { colors } = useTheme()
  const reactions = groupReactions(message.reactions)
  const coins = totalCoins(message.awards)
  const text = bubbleText(message)
  const fg = mine ? '#ffffff' : colors.text
  const photos = message.media ?? []
  const files = message.files ?? []
  const columns = photoColumns(photos.length)
  const tile = columns === 1 ? PHOTO_WIDTH : Math.floor((PHOTO_WIDTH - 4 * (columns - 1)) / columns)
  // какой файл сейчас сохраняется и не получилось ли (пока идёт загрузка, повторное нажатие ничего не делает)
  const [saving, setSaving] = useState<string>()
  const [saveFailed, setSaveFailed] = useState(false)

  async function save(id: string, url: string, name: string) {
    if (saving) return
    setSaving(id)
    setSaveFailed(false)
    try {
      await saveRemoteFile(url, name)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(undefined)
    }
  }

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 3 }}>
      <Pressable
        onLongPress={onFeedback}
        delayLongPress={450}
        accessibilityRole={onFeedback ? 'button' : undefined}
        accessibilityHint={onFeedback ? 'Удерживайте, чтобы поставить реакцию' : undefined}
        style={{ maxWidth: '100%' }}
      >
        <Bubble $mine={mine}>
          {showSender && !mine && (
            <Text $weight="extraBold" $size={13} $tone="accent">
              {`${senderName ?? 'Участник'}${senderMood ? ` ${senderMood}` : ''}`}
            </Text>
          )}
          {photos.length > 0 && (
            <View style={{ width: PHOTO_WIDTH, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {photos.map((photo, i) => {
                // одно фото показываем по его пропорциям (не выше предела), несколько квадратными плитками
                const ratio = photos.length === 1 ? Math.max(0.6, photo.width / photo.height) : 1
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => onOpenPhoto?.(i)}
                    onLongPress={onFeedback}
                    delayLongPress={450}
                    accessibilityRole="button"
                    accessibilityLabel={photos.length === 1 ? 'Открыть фото' : `Открыть фото ${i + 1} из ${photos.length}`}
                  >
                    <Image source={{ uri: photos.length === 1 ? photo.fullUrl : photo.thumbUrl }} style={{ width: tile, height: tile / ratio, borderRadius: 10 }} resizeMode="cover" />
                  </Pressable>
                )
              })}
            </View>
          )}
          {files.map((file) => (
            <Pressable
              key={file.id}
              disabled={saving === file.id}
              onPress={() => void save(file.id, file.url, file.name)}
              onLongPress={onFeedback}
              delayLongPress={450}
              accessibilityRole="button"
              accessibilityLabel={`Скачать файл ${file.name}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, maxWidth: PHOTO_WIDTH }}
            >
              <Ionicons name="document-outline" size={26} color={fg} />
              <View style={{ flexShrink: 1 }}>
                <Text $weight="extraBold" $size={14} numberOfLines={1} style={{ color: fg }}>
                  {file.name}
                </Text>
                <Text $size={12} style={{ color: fg, opacity: 0.7 }}>
                  {saving === file.id ? 'Скачивается…' : formatFileSize(file.size)}
                </Text>
              </View>
            </Pressable>
          ))}
          {saveFailed && (
            <Text $size={12} style={{ color: fg }}>
              Не удалось сохранить файл.
            </Text>
          )}
          {text ? (
            <Text selectable={false} style={{ color: fg }}>
              {text}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text $size={11} style={{ color: fg, opacity: 0.7 }}>
              {formatMessageTime(message.createdAt)}
            </Text>
            {mine && status && <ReadTicks status={status} color={fg} dim />}
          </View>
        </Bubble>
      </Pressable>
      {(reactions.length > 0 || coins > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -8, marginHorizontal: 8 }} accessibilityLabel="Реакции и монеты">
          {reactions.map((r) => (
            <Chip key={r.emoji} accessibilityLabel={`Реакция ${r.emoji}${r.count > 1 ? `, ${r.count}` : ''}`}>
              <Text $size={14}>{r.emoji}</Text>
              {r.count > 1 && (
                <Text $size={12} $weight="bold" $tone="muted">
                  {String(r.count)}
                </Text>
              )}
            </Chip>
          ))}
          {coins > 0 && (
            <Chip accessibilityLabel={`Начислено монет: ${coins}`}>
              <CoinIcon size={14} />
              <Text $size={12} $weight="black" style={{ color: '#7a4b00' }}>{`+${coins}`}</Text>
            </Chip>
          )}
        </View>
      )}
    </View>
  )
}
