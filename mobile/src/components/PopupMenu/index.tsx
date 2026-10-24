import { useRef, useState, type ComponentRef } from 'react'
import { Modal, Pressable, View, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { useInFlight } from '@/lib/useInFlight'
import type { SheetAction } from '../ActionSheet'
import { Notice } from '../Notice'
import { Text } from '../Text'

export interface MenuAction extends SheetAction {
  // пункт-переключатель: флажок слева, отмечен, когда включён
  checked?: boolean
}

interface Anchor {
  x: number
  y: number
  width: number
  height: number
}

const MENU_WIDTH = 250
const MARGIN = 12

// Меню, которое раскрывается рядом со значком «три точки» (под ним, по его правому краю), как настоящее всплывающее меню.
// Действие выполняется по нажатию, при успехе меню закрывается, при ошибке остаётся с сообщением.
function PopupMenu({ anchor, actions, onClose }: { anchor: Anchor; actions: MenuAction[]; onClose: () => void }) {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const guard = useInFlight()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const run = guard(async (action: MenuAction) => {
    setBusy(true)
    setError(undefined)
    try {
      await action.onSelect()
      onClose()
    } catch {
      setError('Не удалось выполнить действие. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  // по правому краю значка, но не за пределы экрана
  const right = Math.max(MARGIN, width - (anchor.x + anchor.width))
  const menuWidth = Math.min(MENU_WIDTH, width - 2 * MARGIN)

  return (
    <Modal transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityLabel="Закрыть меню">
        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            top: anchor.y + anchor.height + 6,
            right,
            width: menuWidth,
            paddingVertical: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.surface,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          {actions.map((action) => (
            <Pressable
              key={action.key}
              disabled={busy}
              onPress={() => void run(action)}
              accessibilityRole="menuitem"
              accessibilityState={action.checked === undefined ? undefined : { checked: action.checked }}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, opacity: busy ? 0.5 : 1 }}
            >
              {action.checked !== undefined && <Ionicons name={action.checked ? 'checkbox' : 'square-outline'} size={20} color={action.checked ? colors.accent : colors.muted} />}
              <Text $weight="bold" $tone={action.danger ? 'error' : 'default'} style={{ flex: 1 }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
          {error && (
            <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
              <Notice tone="error">{error}</Notice>
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  )
}

// Значок «три точки» с меню рядом: меню раскрывается под значком
export function MenuButton({ actions, accessibilityLabel = 'Меню', filled = true, size = 38 }: { actions: MenuAction[]; accessibilityLabel?: string; filled?: boolean; size?: number }) {
  const { colors } = useTheme()
  const ref = useRef<ComponentRef<typeof Pressable>>(null)
  const [anchor, setAnchor] = useState<Anchor>()

  function open() {
    ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))
  }

  return (
    <>
      <Pressable
        ref={ref}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Открывает меню"
        hitSlop={8}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? colors.track : 'transparent' }}
      >
        <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
      </Pressable>
      {anchor && <PopupMenu anchor={anchor} actions={actions} onClose={() => setAnchor(undefined)} />}
    </>
  )
}
