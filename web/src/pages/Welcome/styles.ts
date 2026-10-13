import styled from 'styled-components'

export const Hero = styled.div`
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;

  h1 {
    font-size: 2.2rem;
  }

  p {
    max-width: 20rem;
    color: var(--muted);
  }
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: env(safe-area-inset-bottom);
`

export const Features = styled.ul`
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;

  li {
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--glass-edge);
    border-radius: 2rem;
    background: var(--auth-card);
    font-size: 0.9rem;
    font-weight: 600;
  }
`
