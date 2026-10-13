import styled, { keyframes } from 'styled-components'

const pulse = keyframes`
  0%, 100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
`

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.25rem 0;
`

// серый «пузырь» вместо сообщения: переписка занимает своё место ещё до загрузки
export const Ghost = styled.div<{ $mine: boolean; $width: string; $height: string }>`
  align-self: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  border-radius: 1rem;
  ${({ $mine }) => ($mine ? 'border-bottom-right-radius: 0.3rem;' : 'border-bottom-left-radius: 0.3rem;')}
  background: color-mix(in srgb, var(--muted) 18%, transparent);
  animation: ${pulse} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`
