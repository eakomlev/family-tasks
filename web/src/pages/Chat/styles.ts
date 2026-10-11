import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: inherit;
  text-decoration: none;

  &:hover {
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// значок общего чата вместо аватара
export const FamilyIcon = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  font-size: 1.3rem;
`

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`

export const Top = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
`

export const Name = styled.strong<{ $unread: boolean }>`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${({ $unread }) => ($unread ? 700 : 600)};
`

export const Time = styled.span<{ $unread: boolean }>`
  flex: none;
  color: ${({ $unread }) => ($unread ? 'var(--accent)' : 'var(--muted)')};
  font-size: 0.8rem;
`

export const Bottom = styled.div`
  display: flex;
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
  font-size: 0.9rem;
`

export const Count = styled.span`
  flex: none;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.35rem;
  text-align: center;
`
