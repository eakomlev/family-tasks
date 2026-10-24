import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  /* справа вверху может лежать баланс монет ребёнка */
  padding-right: var(--topbar-reserve, 0);
`

// справа в шапке: меню «три точки» и «＋» новой задачи
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
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

// «＋» новой задачи: круглая кнопка в шапке
export const AddLink = styled(Link)`
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  box-shadow: var(--accent-shadow);

  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
`

// запас под плавающей кнопкой, чтобы последняя строка не пряталась за ней
export const ListEnd = styled.div`
  height: 4rem;
`
