import { Link } from 'react-router-dom'
import styled from 'styled-components'

// Список как в Telegram: строки во всю ширину без карточек, тонкая линия между ними начинается от текста (не от аватара)
export const List = styled.ul`
  display: grid;
  /* одна колонка ровно по ширине экрана: без этого длинное сообщение в строке без переносов раздувает колонку за экран */
  grid-template-columns: minmax(0, 1fr);
  margin: 0 -1rem;
  padding: 0;
  list-style: none;

  li {
    position: relative;
  }

  li:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: calc(1rem + 3.4rem + 0.8rem);
    height: 1px;
    background: var(--border);
  }
`

export const Row = styled(Link)`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 1rem;
  color: inherit;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s ease;

  &:active {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  @media (hover: hover) {
    &:hover {
      background: color-mix(in srgb, var(--accent) 6%, transparent);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`

// значок общего чата вместо аватара
export const FamilyIcon = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  font-size: 1.7rem;
`

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`

export const Top = styled.div`
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
`

export const Name = styled.strong<{ $unread: boolean }>`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.05rem;
  font-weight: 600;
`

export const Time = styled.span<{ $unread: boolean }>`
  flex: none;
  color: ${({ $unread }) => ($unread ? 'var(--accent)' : 'var(--muted)')};
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
`

export const Bottom = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`

export const Preview = styled.span<{ $unread: boolean }>`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $unread }) => ($unread ? 'var(--text)' : 'var(--muted)')};
  font-size: 0.95rem;
`

// «Вы:» и имя автора в общем чате выделены, дальше текст сообщения
export const Prefix = styled.span<{ $mine: boolean }>`
  color: ${({ $mine }) => ($mine ? 'var(--muted)' : 'var(--accent)')};
  font-weight: 600;
`

export const Count = styled.span`
  flex: none;
  min-width: 1.45rem;
  height: 1.45rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.45rem;
  text-align: center;
`

// серые строки вместо списка, пока он грузится
export const Ghost = styled.li`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 1rem;

  > span:first-child {
    flex: none;
    width: 3.4rem;
    height: 3.4rem;
    border-radius: 50%;
  }

  > div {
    flex: 1;
    display: grid;
    gap: 0.5rem;
  }

  > div span {
    display: block;
    height: 0.8rem;
    border-radius: 0.4rem;
  }

  > div span:first-child {
    width: 40%;
  }

  > div span:last-child {
    width: 75%;
  }

  span {
    background: color-mix(in srgb, var(--muted) 18%, transparent);
    animation: ghost-pulse 1.4s ease-in-out infinite;
  }

  @keyframes ghost-pulse {
    0%, 100% {
      opacity: 0.5;
    }

    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      animation: none;
    }
  }
`
