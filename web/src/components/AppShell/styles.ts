import styled from 'styled-components'

// переменная нужна и панели табов, и содержимому, чтобы оно не пряталось под панелью
export const Root = styled.div`
  --tabbar-height: calc(3.75rem + env(safe-area-inset-bottom));
`

export const Content = styled.div`
  padding-bottom: var(--tabbar-height);

  /* страница занимает экран минус панель табов, а не весь экран */
  > main {
    min-height: calc(100dvh - var(--tabbar-height));
  }
`
