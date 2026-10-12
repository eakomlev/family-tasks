import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const List = styled.ul`
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
`

// плавающая кнопка внизу, как «Новая задача» на странице заданий
export const AddButton = styled(Link)`
  position: fixed;
  right: max(1rem, calc((100vw - 28rem) / 2 + 1rem));
  bottom: calc(var(--tabbar-height, 4.5rem) + 0.4rem);
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

// запас под плавающей кнопкой
export const ListEnd = styled.div`
  height: 4rem;
`
