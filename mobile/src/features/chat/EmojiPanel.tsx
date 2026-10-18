import { useMemo, useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from 'styled-components/native'
import { Text } from '@/components/Text'
import { EMOJI_CATEGORIES, loadRecent } from './emoji'

export const EMOJI_PANEL_HEIGHT = 300
const COLUMNS = 8

// Панель эмодзи вместо клавиатуры: вкладки категорий («Недавние» первой, когда уже что-то выбирали), сетка, «стереть» справа внизу.
export function EmojiPanel({ recent, onPick, onBackspace }: { recent: string[]; onPick: (emoji: string) => void; onBackspace: () => void }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const tabs = useMemo(() => {
    const list = EMOJI_CATEGORIES.map((c) => ({ key: c.key, icon: c.icon, title: c.title, items: c.items }))
    return recent.length > 0 ? [{ key: 'recent', icon: '🕘', title: 'Недавние', items: recent }, ...list] : list
  }, [recent])
  const [active, setActive] = useState(() => (loadRecent().length > 0 ? 'recent' : EMOJI_CATEGORIES[0].key))
  const tab = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <View style={{ height: EMOJI_PANEL_HEIGHT + insets.bottom, paddingBottom: insets.bottom, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActive(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: t.key === tab.key }}
            accessibilityLabel={t.title}
            style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: t.key === tab.key ? colors.accent : 'transparent' }}
          >
            <Text $size={22}>{t.icon}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        key={tab.key}
        data={tab.items}
        numColumns={COLUMNS}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ padding: 6, paddingBottom: 60 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} accessibilityRole="button" accessibilityLabel={item} style={{ flex: 1 / COLUMNS, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Text $size={28} style={{ lineHeight: 36 }}>
              {item}
            </Text>
          </Pressable>
        )}
      />
      <Pressable
        onPress={onBackspace}
        accessibilityRole="button"
        accessibilityLabel="Стереть"
        hitSlop={8}
        style={{ position: 'absolute', right: 14, bottom: insets.bottom + 10, width: 48, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
      >
        <Ionicons name="backspace-outline" size={24} color={colors.text} />
      </Pressable>
    </View>
  )
}
