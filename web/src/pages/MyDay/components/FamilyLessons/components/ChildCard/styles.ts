import { Link } from 'react-router-dom'
import styled from 'styled-components'

// карточка ребёнка: сверху ссылка на расписание (уроки, тренировка), ниже задания на сегодня со своими ссылками
export const Card = styled.div`
  display: grid;
  gap: 0.35rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);

  &:hover {
    border-color: var(--accent);
  }
`

export const Schedule = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.15rem 0.7rem;
  align-items: center;
  color: inherit;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 0.5rem;
  }
`

export const Top = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
`

export const Name = styled.strong`
  min-width: 0;
  font-size: 1.2rem;
  overflow-wrap: anywhere;
`

export const When = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.85rem;
`

export const Subjects = styled.p`
  grid-column: 2;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
`

// уроки столбиком: номер, предмет и (если указан) кабинет справа
export const Lessons = styled.ol`
  grid-column: 2;
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-width: 0;
    font-size: 0.95rem;
  }

  li > span:nth-child(2) {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

export const LessonNumber = styled.span`
  flex: none;
  width: 1rem;
  color: var(--muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
`

export const Room = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.8rem;
`

export const Meta = styled.p`
  grid-column: 2;
  color: var(--muted);
  font-size: 0.8rem;
`

export const Training = styled.p`
  grid-column: 2;
  margin-top: 0.15rem;
  padding-top: 0.35rem;
  border-top: 1px dashed var(--border);
  color: var(--muted);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
`
