import styled from 'styled-components'

export const Description = styled.p`
  margin: 0;
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  /* переносы строк из текста сохраняются */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const Details = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  margin: 0;

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
`

export const Who = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
`

// кнопки выполнения прижаты к низу страницы
export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: auto;
  padding-top: 1rem;
`
