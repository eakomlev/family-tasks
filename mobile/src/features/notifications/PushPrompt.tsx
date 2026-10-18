import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Text } from '@/components/Text'
import { dismissPrompt, isPromptDismissed, usePush } from './usePush'

// Плашка на «Моём дне»: уведомления выключены. Разрешение у системы просят по нажатию, автоматически включить нельзя.
export function PushPrompt() {
  const { state, busy, enable } = usePush()
  const [hidden, setHidden] = useState(isPromptDismissed)

  if (hidden || state !== 'off') return null
  return (
    <Card style={{ gap: 10 }}>
      <Text $weight="extraBold">Включить уведомления?</Text>
      <Text $size={14} $tone="muted">Сообщения, награды и напоминания придут на телефон, даже когда приложение закрыто.</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button variant="primary" disabled={busy} onPress={enable}>Включить</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            onPress={() => {
              dismissPrompt()
              setHidden(true)
            }}
          >
            Позже
          </Button>
        </View>
      </View>
    </Card>
  )
}
