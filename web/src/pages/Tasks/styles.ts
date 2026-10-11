import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  /* справа вверху лежат значок профиля и баланс монет; если выпадающий список не помещается, он уходит на строку ниже */
  flex-wrap: wrap;
  row-gap: 0.5rem;
  padding-right: var(--topbar-reserve, 3rem);

  select {
    /* высота как у заголовка страницы, чтобы строка заголовка и значок профиля были на одном уровне */
    padding: 0.3rem 0.75rem;
  }
`

export const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
`

export const SectionTitle = styled.h2`
  margin: 0.5rem 0 0;
`

// плавающая кнопка: поверх всего, над панелью табов; на широком экране прижата к краю колонки (28rem), а не окна
export const AddButton = styled(Link)`
  position: fixed;
  right: max(1rem, calc((100vw - 28rem) / 2 + 1rem));
  bottom: calc(var(--tabbar-height, 3.75rem) + 1rem);
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.85rem 1.25rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
`

// запас под плавающей кнопкой, чтобы последняя строка не пряталась за ней
export const ListEnd = styled.div`
  height: 4rem;
`
