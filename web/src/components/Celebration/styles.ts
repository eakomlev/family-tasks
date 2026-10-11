import styled, { keyframes } from 'styled-components'

const pop = keyframes`
  0% { transform: scale(0.2) rotate(-25deg); opacity: 0; }
  60% { transform: scale(1.25) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); }
`

// закрывает всю страницу, как окно подтверждения
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  overflow-y: auto;
  background: var(--bg);
`

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 24rem;
  text-align: center;

  h1 {
    margin: 0;
    font-size: 2rem;
  }

  p {
    margin: 0;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
`

export const Emoji = styled.div`
  font-size: 6rem;
  line-height: 1;
  animation: ${pop} 0.7s cubic-bezier(0.3, 1.4, 0.5, 1) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
