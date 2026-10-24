import { useRef, useState } from 'react'
import { CachedImage } from '@/components/CachedImage'
import { FlatList, Modal, Pressable, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ChatMedia } from '@/api'
import { Text } from '@/components/Text'
import { saveRemoteFile } from '@/lib/saveFile'
import { useInFlight } from '@/lib/useInFlight'

// Просмотр фото на весь экран: все фото сообщения в одной ленте, листаются пальцем. «Сохранить» отдаёт файл системному меню
// «Поделиться» (на iPhone там «Сохранить изображение»), просмотр остаётся открытым.
export function PhotoViewer({ photos, index, onClose }: { photos: ChatMedia[]; index: number; onClose: () => void }) {
  const guard = useInFlight()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [current, setCurrent] = useState(index)
  const [error, setError] = useState(false)
  const list = useRef<FlatList<ChatMedia>>(null)

  const save = guard(async () => {
    setError(false)
    try {
      await saveRemoteFile(photos[current].fullUrl, `photo-${photos[current].id}.jpg`)
    } catch {
      setError(true)
    }
  })

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <FlatList
          ref={list}
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(photo) => photo.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Фото. Нажмите, чтобы закрыть">
              <CachedImage uri={item.fullUrl} style={{ width, height: height - 160 }} contentFit="contain" />
            </Pressable>
          )}
        />
        <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={12}>
            <Ionicons name="close" size={30} color="#ffffff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          {photos.length > 1 && (
            <Text $weight="bold" style={{ color: '#ffffff' }}>
              {`${current + 1} из ${photos.length}`}
            </Text>
          )}
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0, alignItems: 'center', gap: 8 }}>
          {error && <Text style={{ color: '#ffb4ab' }}>Не удалось сохранить фото</Text>}
          <Pressable onPress={save} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Ionicons name="download-outline" size={20} color="#ffffff" />
            <Text $weight="extraBold" style={{ color: '#ffffff' }}>
              Сохранить
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
