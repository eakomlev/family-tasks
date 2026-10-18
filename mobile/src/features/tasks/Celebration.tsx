import { useState } from 'react'
import { Modal } from 'react-native'
import styled from 'styled-components/native'
import { Button } from '@/components/Button'
import { Text, Title } from '@/components/Text'
import { coinsWord } from '@/lib/coins'
import { Confetti } from './Confetti'
import { EMOJIS, PRAISES, pick } from './celebrationText'

const Overlay = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  background-color: ${({ theme }) => theme.colors.accent};
`

const Reward = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.coinBg};
`

// Экран поздравления на весь экран после выполнения задания, с конфетти
export function Celebration({ title, reward, onClose }: { title: string; reward?: number; onClose: () => void }) {
  const [praise] = useState(() => pick(PRAISES))
  const [emoji] = useState(() => pick(EMOJIS))

  return (
    <Modal animationType="fade" onRequestClose={onClose}>
      <Overlay accessibilityViewIsModal>
        <Confetti />
        <Text $size={72}>{emoji}</Text>
        <Title style={{ color: '#ffffff', textAlign: 'center' }}>{praise}</Title>
        <Text style={{ color: '#dcd7ff', textAlign: 'center' }}>{`Задание «${title}» выполнено.`}</Text>
        {reward !== undefined && reward > 0 && (
          <Reward>
            <Text $size={22}>🪙</Text>
            <Text $weight="black" $size={20} style={{ color: '#7a4b00' }}>{`+${coinsWord(reward)}`}</Text>
          </Reward>
        )}
        <Button variant="lime" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 12 }}>
          Отлично
        </Button>
      </Overlay>
    </Modal>
  )
}
