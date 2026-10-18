import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Image, Pressable, useWindowDimensions, View } from 'react-native'
import { Redirect } from 'expo-router'
import { listChatMedia, type ChatMediaItem } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { TOP_CORNER } from '@/components/Screen'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { retryRead } from '@/lib/retry'
import { useProfile } from '@/profile/context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PhotoViewer } from './PhotoViewer'
import { chatTitle } from './listUtils'

const GAP = 4
const COLUMNS = 3

// Все фото чата («Медиа файлы» в меню чата): свежие первыми, старые подгружаются по мере прокрутки; нажатие открывает просмотр
export function ChatMediaScreen({ chat }: { chat: string }) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const token = identity?.token

  const [items, setItems] = useState<ChatMediaItem[]>()
  const [hasMore, setHasMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewing, setViewing] = useState<number>()
  // защита от двойной подгрузки: список может позвать её несколько раз, пока идёт запрос
  const busy = useRef(false)

  // before не задан: первая страница; иначе более старые после фото с этим id
  const load = useCallback(
    async (before?: string) => {
      if (!token || busy.current) return
      busy.current = true
      setLoading(true)
      try {
        const page = await retryRead(() => listChatMedia(token, chat, before))
        setItems((current) => {
          const known = current ?? []
          return before ? [...known, ...page.items.filter((p) => !known.some((k) => k.id === p.id))] : page.items
        })
        setHasMore(page.hasMore)
        setFailed(false)
      } catch {
        setFailed(true)
      } finally {
        busy.current = false
        setLoading(false)
      }
    },
    [token, chat],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (!identity) return <Redirect href="/chat" />
  const title = chatTitle(chat, data?.members ?? [], identity.role)
  const side = (width - 40 - GAP * (COLUMNS - 1)) / COLUMNS

  return (
    <>
      <FlatList
        data={items ?? []}
        numColumns={COLUMNS}
        keyExtractor={(photo) => photo.id}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + TOP_CORNER, paddingBottom: 40, gap: GAP }}
        onEndReached={() => hasMore && !failed && items?.length && void load(items[items.length - 1].id)}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <BackLink fallback={{ pathname: '/chat/[chat]', params: { chat } }}>{`← ${title}`}</BackLink>
            <Title>Медиа файлы</Title>
            {failed && !items && <Notice tone="error">Не удалось загрузить фото.</Notice>}
            {failed && !items && <Button variant="text" onPress={() => void load()}>Повторить</Button>}
            {!items && !failed && <Text $tone="muted">Загрузка…</Text>}
            {items && items.length === 0 && <Notice>В этом чате пока нет фото.</Notice>}
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setViewing(index)} accessibilityRole="button" accessibilityLabel="Открыть фото">
            <Image source={{ uri: item.thumbUrl }} style={{ width: side, height: side, borderRadius: 8 }} />
          </Pressable>
        )}
        ListFooterComponent={hasMore && !failed ? <Button variant="text" disabled={loading} onPress={() => items?.length && void load(items[items.length - 1].id)}>{loading ? 'Загрузка…' : 'Показать ещё'}</Button> : <View />}
      />
      {viewing !== undefined && items && <PhotoViewer photos={items} index={viewing} onClose={() => setViewing(undefined)} />}
    </>
  )
}
