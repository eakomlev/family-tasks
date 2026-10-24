import styled from 'styled-components'

export const Frame = styled.div`
  width: 100%;
  max-width: 20rem;
  margin: 0 auto;
  container-type: inline-size;
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  aspect-ratio: 1;
`

export const Cell = styled.button<{ $mark?: 'last' | 'win' }>`
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 0.9rem;
  background: ${({ $mark }) => ($mark === 'win' ? 'var(--done-bg, rgb(80 200 120 / 0.25))' : $mark === 'last' ? 'var(--track)' : 'var(--surface)')};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
  }
`

export const Mark = styled.span<{ $o: boolean }>`
  font-size: 22cqw;
  line-height: 1;
  font-weight: 900;
  color: ${({ $o }) => ($o ? 'var(--coin, #f2b94b)' : 'var(--accent)')};
  user-select: none;
`
