import styled from 'styled-components'

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 2.5rem;
`

export const Icon = styled.div`
  font-size: 3rem;
  line-height: 1;
`

export const DateLine = styled.p`
  color: var(--muted);
`

export const Empty = styled.p`
  margin-top: 1rem;
  padding: 1.5rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 0.8rem;
  color: var(--muted);
  text-align: center;
`
