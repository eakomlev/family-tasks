import { Link } from 'react-router-dom'
import styled from 'styled-components'

// переменная нужна и панели табов, и содержимому, чтобы оно не пряталось под панелью
export const Root = styled.div<{ $reserve: string; $chatRoom: boolean }>`
  /* плавающая панель табов: высота овала, зазор под ним и часть нижнего отступа iPhone (индикатор «Домой» остаётся ниже) */
  --tabbar-bottom: calc(env(safe-area-inset-bottom) * 0.4);
  --tabbar-bar-height: 4rem;
  --tabbar-gap: 0.6rem;
  /* в переписке панели табов нет: остаётся лишь часть нижнего отступа под индикатор «Домой», поле ввода почти у края экрана */
  --tabbar-height: ${({ $chatRoom }) => ($chatRoom ? 'var(--tabbar-bottom)' : 'calc(var(--tabbar-bar-height) + var(--tabbar-gap) + var(--tabbar-bottom) + 0.6rem)')};
  /* сколько места справа вверху занимают баланс монет (у детей) и значок профиля: шапки страниц не должны под них заезжать */
  --topbar-reserve: ${({ $reserve }) => $reserve};
  position: relative;
  /* выезжающие страницы не расширяют документ: иначе значок профиля уезжает вместе с шириной (clip не создаёт прокрутку, sticky работает) */
  overflow-x: clip;
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
export const TopRight = styled.div<{ $fixed: boolean }>`
  /* в переписке шапка закреплена, значок с монетами тоже не уезжает при прокрутке */
  position: ${({ $fixed }) => ($fixed ? 'fixed' : 'absolute')};
  /* по центру строки с заголовком страницы: заголовок начинается на 1.5rem, его высота около 31px, значок 40px */
  top: calc(1.2rem + env(safe-area-inset-top));
  right: 0.75rem;
  z-index: 11;
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
