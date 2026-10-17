import styled from 'styled-components'

export const Tile = styled.span`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--card-border);
  border-radius: 1rem;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: var(--text);
`

export const Weekday = styled.span`
  color: var(--accent);
  font-size: 0.65rem;
  font-weight: 900;
  line-height: 1.2;
`

export const Day = styled.span`
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1;
`
