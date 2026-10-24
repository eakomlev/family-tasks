import { Link } from 'react-router-dom'
import styled from 'styled-components'

// переменная нужна и панели табов, и содержимому, чтобы оно не пряталось под панелью
export const Root = styled.div<{ $reserve: string; $noTabs: boolean }>`
  /* плавающая панель табов: высота овала, зазор под ним и часть нижнего отступа iPhone (индикатор «Домой» остаётся ниже) */
  --tabbar-bottom: calc(env(safe-area-inset-bottom) * 0.4);
  --tabbar-bar-height: 4rem;
  --tabbar-gap: 0.6rem;
  /* в переписке и на вложенных страницах панели табов нет: остаётся лишь часть нижнего отступа под индикатор «Домой» */
  --tabbar-height: ${({ $noTabs }) => ($noTabs ? 'var(--tabbar-bottom)' : 'calc(var(--tabbar-bar-height) + var(--tabbar-gap) + var(--tabbar-bottom) + 0.6rem)')};
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
`

// правый верхний угол: баланс монет (у детей) слева от значка профиля
export const TopRight = styled.div<{ $fixed: boolean }>`
  /* в переписке шапка закреплена, значок с монетами тоже не уезжает при прокрутке */
  position: ${({ $fixed }) => ($fixed ? 'fixed' : 'absolute')};
  /* по центру строки с заголовком страницы: заголовок начинается на 1.5rem, его высота около 31px, значок 40px */
  /* в переписке экран стоит на видимой области, которую клавиатура может сдвинуть вниз (--vv-top), значок едет с ней */
  top: calc(1.2rem + env(safe-area-inset-top) + ${({ $fixed }) => ($fixed ? 'var(--vv-top, 0px)' : '0px')});
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
