import styled, { keyframes } from 'styled-components'

export const Page = styled.main`
  max-width: 28rem;
  min-height: 100dvh;
  margin: 0 auto;
  padding: calc(1.5rem + env(safe-area-inset-top)) 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }

  to {
    transform: none;
  }
`

// страница выезжает справа при открытии (карточка задания), как переписка в чате
export const SlideInPage = styled(Page)`
  animation: ${slideIn} 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
