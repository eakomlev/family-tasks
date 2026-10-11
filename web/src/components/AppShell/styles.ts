import { Link } from 'react-router-dom'
import styled from 'styled-components'

// переменная нужна и панели табов, и содержимому, чтобы оно не пряталось под панелью
export const Root = styled.div<{ $reserve: string }>`
  --tabbar-height: calc(3.75rem + env(safe-area-inset-bottom));
  /* сколько места справа вверху занимают баланс монет (у детей) и значок профиля: шапки страниц не должны под них заезжать */
  --topbar-reserve: ${({ $reserve }) => $reserve};
  position: relative;
`

export const Content = styled.div`
  padding-bottom: var(--tabbar-height);

  /* страница занимает экран минус панель табов, а не весь экран */
  > main {
    min-height: calc(100dvh - var(--tabbar-height));
  }

  /* открыта экранная клавиатура (чат): панели табов нет */
  :root[data-keyboard] & {
    padding-bottom: env(safe-area-inset-bottom);
  }
`

// правый верхний угол: баланс монет (у детей) слева от значка профиля
export const TopRight = styled.div`
  position: absolute;
  /* по центру строки с заголовком страницы: заголовок начинается на 1.5rem, его высота около 31px, значок 40px */
  top: calc(1.2rem + env(safe-area-inset-top));
  right: 0.75rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.5rem;
`

export const ProfileLink = styled(Link)`
  display: block;
  border-radius: 50%;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
