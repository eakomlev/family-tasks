import styled from 'styled-components'

export const Wrap = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`

export const Bubble = styled.div<{ $mine: boolean; $clickable?: boolean }>`
  max-width: 82%;
  padding: 0.3rem 0.6rem;
  border-radius: 1rem;
  ${({ $mine }) => ($mine ? 'border-bottom-right-radius: 0.3rem;' : 'border-bottom-left-radius: 0.3rem;')}
  background: ${({ $mine }) => ($mine ? 'var(--accent)' : 'var(--surface)')};
  color: ${({ $mine }) => ($mine ? 'var(--accent-text)' : 'var(--text)')};
  border: 1px solid ${({ $mine }) => ($mine ? 'var(--accent)' : 'var(--border)')};
  ${({ $clickable }) =>
    $clickable
      ? `cursor: pointer;
  &:hover { border-color: var(--accent); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
      : ''}
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

// Реакции и монеты слегка заезжают на нижний край пузыря и сдвинуты внутрь от его угла, как в популярных мессенджерах
export const Extras = styled.div<{ $mine: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  max-width: 82%;
  margin: -0.6rem ${({ $mine }) => ($mine ? '0.7rem' : '0')} 0.15rem ${({ $mine }) => ($mine ? '0' : '0.7rem')};
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`

export const ReactionChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--bg);
  font-size: 0.95rem;

  small {
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
`

export const CoinPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.55rem 0.1rem 0.3rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--bg);
  font-size: 0.85rem;
  font-weight: 700;

  svg {
    width: 1.1rem;
    height: 1.1rem;
  }
`
