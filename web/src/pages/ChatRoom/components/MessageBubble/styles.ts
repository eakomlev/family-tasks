import styled from 'styled-components'

export const Wrap = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`

export const Bubble = styled.div<{ $mine: boolean }>`
  max-width: 82%;
  padding: 0.5rem 0.75rem;
  border-radius: 1rem;
  ${({ $mine }) => ($mine ? 'border-bottom-right-radius: 0.3rem;' : 'border-bottom-left-radius: 0.3rem;')}
  background: ${({ $mine }) => ($mine ? 'var(--accent)' : 'var(--surface)')};
  color: ${({ $mine }) => ($mine ? 'var(--accent-text)' : 'var(--text)')};
  border: 1px solid ${({ $mine }) => ($mine ? 'var(--accent)' : 'var(--border)')};
`

export const Sender = styled.div`
  margin-bottom: 0.1rem;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
`

// переносы строк из сообщения сохраняются
export const Text = styled.div`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  margin-top: 0.1rem;
`

export const Time = styled.span`
  font-size: 0.7rem;
  opacity: 0.7;
`

// галочки статуса на акцентном фоне своего пузыря: у «отправлено» приглушённая, у «прочитано» двойная и яркая
export const Tick = styled.span<{ $read: boolean }>`
  display: inline-flex;
  opacity: ${({ $read }) => ($read ? 1 : 0.6)};

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
