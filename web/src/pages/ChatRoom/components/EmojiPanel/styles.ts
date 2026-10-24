import styled from 'styled-components'

export const Panel = styled.div`
  border-top: 1px solid var(--border);
  background: var(--surface);
`

export const Tabs = styled.div`
  display: flex;
  gap: 0.15rem;
  padding: 0.3rem 0.4rem;
  overflow-x: auto;
`

export const TabButton = styled.button<{ $active?: boolean }>`
  flex: none;
  min-width: 2.2rem;
  height: 2.2rem;
  border: 0;
  border-radius: 0.7rem;
  background: ${({ $active }) => ($active ? 'var(--accent-soft, var(--track))' : 'transparent')};
  font-size: 1.2rem;
  cursor: pointer;
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));
  max-height: 11rem;
  overflow-y: auto;
  padding: 0 0.4rem 0.4rem;
`

export const Cell = styled.button`
  height: 2.4rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;

  &:hover {
    background: var(--track);
  }
`
