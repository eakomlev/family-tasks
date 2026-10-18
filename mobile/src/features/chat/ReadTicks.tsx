import Svg, { Path } from 'react-native-svg'

export type TicksStatus = 'sent' | 'read'

// Галочки статуса своего сообщения, как в Telegram: одна «отправлено», две «прочитано»
export function ReadTicks({ status, color, dim = false }: { status: TicksStatus; color: string; dim?: boolean }) {
  return (
    <Svg
      width={16}
      height={10}
      viewBox="0 0 20 12"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={dim && status !== 'read' ? 0.6 : 1}
      accessibilityLabel={status === 'read' ? 'Прочитано' : 'Отправлено'}
    >
      {/* одна галочка: отправлено; вторая, сдвинутая, добавляется у прочитанного */}
      <Path d="m1.5 6.5 3.2 3.2L11 2.5" />
      {status === 'read' && <Path d="m8.5 8.4 1.1 1.3L17.5 2.5" />}
    </Svg>
  )
}
