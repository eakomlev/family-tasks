import styled from 'styled-components'

export type TicksStatus = 'sent' | 'read'

const Ticks = styled.span<{ $read: boolean; $dim: boolean }>`
  display: inline-flex;
  opacity: ${({ $read, $dim }) => ($dim && !$read ? 0.6 : 1)};

  svg {
    width: 1rem;
    height: 0.65rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

// Галочки статуса своего сообщения, как в Telegram: одна «отправлено», две «прочитано». Цвет берётся от родителя (currentColor);
// dim приглушает «отправлено» (в пузыре на акцентном фоне), в списке чатов цвет задаёт родитель.
export function ReadTicks({ status, dim = false }: { status: TicksStatus; dim?: boolean }) {
  return (
    <Ticks $read={status === 'read'} $dim={dim} role="img" aria-label={status === 'read' ? 'Прочитано' : 'Отправлено'}>
      <svg viewBox="0 0 20 12" aria-hidden focusable="false">
        {/* одна галочка: отправлено; вторая, сдвинутая, добавляется у прочитанного */}
        <path d="m1.5 6.5 3.2 3.2L11 2.5" />
        {status === 'read' && <path d="m8.5 8.4 1.1 1.3L17.5 2.5" />}
      </svg>
    </Ticks>
  )
}
