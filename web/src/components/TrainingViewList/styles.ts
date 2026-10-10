import styled from 'styled-components'

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Item = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
`

export const Main = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const Title = styled.span`
  overflow-wrap: anywhere;
`

export const Place = styled.span`
  color: var(--muted);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
`

export const Time = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
`
