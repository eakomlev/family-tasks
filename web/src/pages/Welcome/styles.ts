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

  button {
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--glass-edge);
    border-radius: 2rem;
    background: var(--auth-card);
    color: var(--text);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
`

// ссылки на политику и соглашение внизу первого экрана
export const Legal = styled.p`
  margin: 0;
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
  text-align: center;
  font-size: 0.8rem;
  color: var(--muted);

  a {
    color: inherit;
  }
`
