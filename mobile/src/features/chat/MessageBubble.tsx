import { useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import type { ChatMessage } from '@/api'
import { CachedImage } from '@/components/CachedImage'
import { CoinIcon } from '@/components/Coins'
import { Text } from '@/components/Text'
import { formatFileSize } from '@/lib/files'
import { hapticMenu } from '@/lib/haptics'
import { saveRemoteFile } from '@/lib/saveFile'
import { ReadTicks } from './ReadTicks'
import { bubbleText, formatMessageTime, groupReactions, photoColumns, totalCoins, type MessageStatus } from './roomUtils'

const Bubble = styled.View<{ $mine: boolean; $max: number; $flush: boolean }>`
  max-width: ${({ $max }) => $max}px;
  padding: ${({ $flush }) => ($flush ? '0' : '8px 12px 6px')};
  overflow: hidden;
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
  // своё сообщение ещё уходит (часы вместо галочек) или не ушло (красная иконка слева, нажатие открывает меню)
  delivery?: 'sending' | 'failed'
  onFailedPress?: () => void
  // долгое нажатие открывает окно реакции и монет
  onFeedback?: () => void
  // нажатие на фото: номер фото в сообщении
  onOpenPhoto?: (index: number) => void
  // как подписать автора исходного сообщения, если это ответ
  replyAuthor?: string
}

// Ширина пузыря с вложениями: фиксированная, иначе плитки фото вылезают за него
const PHOTO_WIDTH = 240
// Просвет между плитками фото; у самих плиток углов нет: края скругляет пузырь, как в Telegram
const TILE_GAP = 2

// Пузырь сообщения: свои справа акцентные, чужие слева; внутри фото (плитками) и файлы, под ним реакции и начисленные монеты
export function MessageBubble({ message, mine, senderName, senderMood, showSender, status, delivery, onFailedPress, onOpenPhoto, onFeedback, replyAuthor }: MessageBubbleProps) {
  const { colors } = useTheme()
  // ширина пузыря в пикселях: проценты внутри строки с иконкой ошибки считались бы от самого пузыря и ужимали его
  const maxWidth = Math.round(useWindowDimensions().width * 0.82)
  const reactions = groupReactions(message.reactions)
  const coins = totalCoins(message.awards)
  const text = bubbleText(message)
  const fg = mine ? '#ffffff' : colors.text
  // долгое нажатие открывает окно реакции с лёгким виброоткликом
  const onLongPress = onFeedback
    ? () => {
        hapticMenu()
        onFeedback()
      }
    : undefined
  const photos = message.media ?? []
  const files = message.files ?? []
  // только фото: пузырь без отступов, время поверх снимка
  const photoOnly = photos.length > 0 && !text && files.length === 0
  const columns = photoColumns(photos.length)
  const tile = columns === 1 ? PHOTO_WIDTH : Math.floor((PHOTO_WIDTH - TILE_GAP * (columns - 1)) / columns)
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
        {delivery === 'failed' && (
          <Pressable onPress={onFailedPress} accessibilityRole="button" accessibilityLabel="Не отправлено. Нажмите, чтобы повторить" hitSlop={10}>
            <Ionicons name="alert-circle" size={28} color={colors.error} />
          </Pressable>
        )}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={450}
        accessibilityRole={onFeedback ? 'button' : undefined}
        accessibilityHint={onFeedback ? 'Удерживайте, чтобы поставить реакцию' : undefined}
        style={{ maxWidth: '100%' }}
      >
        <Bubble $mine={mine} $max={maxWidth} $flush={photos.length > 0}>
          {showSender && !mine && (
            <Text $weight="extraBold" $size={13} $tone="accent" style={photos.length > 0 ? { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 } : undefined}>
              {`${senderName ?? 'Участник'}${senderMood ? ` ${senderMood}` : ''}`}
            </Text>
          )}
          {message.replyTo && (
            <View
              style={{ borderLeftWidth: 3, borderLeftColor: mine ? '#ffffff' : colors.accent, paddingLeft: 8, marginBottom: 4, marginHorizontal: photos.length > 0 ? 12 : 0, marginTop: photos.length > 0 ? 6 : 0, maxWidth: PHOTO_WIDTH }}
              accessibilityLabel="Ответ на сообщение"
            >
              <Text $weight="extraBold" $size={12} numberOfLines={1} style={{ color: mine ? '#ffffff' : colors.accent }}>
                {replyAuthor ?? 'Участник'}
              </Text>
              <Text $size={13} numberOfLines={2} style={{ color: fg, opacity: 0.8 }}>
                {message.replyTo.text}
              </Text>
            </View>
          )}
          {photos.length > 0 && (
            <View style={{ width: PHOTO_WIDTH, flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP }}>
              {photos.map((photo, i) => {
                // одно фото показываем по его пропорциям (не выше предела), несколько квадратными плитками
                const ratio = photos.length === 1 ? Math.max(0.6, photo.width / photo.height) : 1
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => onOpenPhoto?.(i)}
                    onLongPress={onLongPress}
                    delayLongPress={450}
                    accessibilityRole="button"
                    accessibilityLabel={photos.length === 1 ? 'Открыть фото' : `Открыть фото ${i + 1} из ${photos.length}`}
                  >
                    <CachedImage uri={photos.length === 1 ? photo.fullUrl : photo.thumbUrl} style={{ width: tile, height: tile / ratio }} contentFit="cover" />
                  </Pressable>
                )
              })}
            </View>
          )}
          {!photoOnly && (
          <View style={photos.length > 0 ? { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6 } : undefined}>
          {files.map((file) => (
            <Pressable
              key={file.id}
              disabled={saving === file.id}
              onPress={() => void save(file.id, file.url, file.name)}
              onLongPress={onLongPress}
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
              {`${message.editedAt ? 'изменено ' : ''}${formatMessageTime(message.createdAt)}`}
            </Text>
            {mine && delivery === 'sending' && <Ionicons name="time-outline" size={13} color={fg} style={{ opacity: 0.7 }} accessibilityLabel="Отправляется" />}
            {mine && !delivery && status && <ReadTicks status={status} color={fg} dim />}
          </View>
          </View>
          )}
          {photoOnly && (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)' }}
            >
              <Text $size={11} style={{ color: '#ffffff' }}>
                {formatMessageTime(message.createdAt)}
              </Text>
              {mine && delivery === 'sending' && <Ionicons name="time-outline" size={13} color="#ffffff" accessibilityLabel="Отправляется" />}
              {mine && !delivery && status && <ReadTicks status={status} color="#ffffff" />}
            </View>
          )}
        </Bubble>
      </Pressable>
      </View>
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
              <Text $size={12} $weight="black" style={{ color: colors.coinText }}>{`+${coins}`}</Text>
            </Chip>
          )}
        </View>
      )}
    </View>
  )
}
