import styled from 'styled-components'

export const Opponent = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);

  div {
    min-width: 0;
  }

  strong,
  small {
    display: block;
  }

  small {
    color: var(--muted);
  }
`

export const Status = styled.h2`
  margin: 0;
  text-align: center;
`

export const Caption = styled.p`
  margin: 0;
  color: var(--muted);
  text-align: center;
`

export const Buttons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`

// итог игры: крупный результат и две кнопки под доской
export const Result = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
`
