import styled from 'styled-components'

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  text-align: center;
`

export const Badge = styled.span`
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.85rem;
`
