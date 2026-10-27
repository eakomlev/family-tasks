import styled from 'styled-components'

// пересылаемый или полученный текст: цитата с акцентной полосой слева
export const Quote = styled.blockquote`
  margin: 0;
  padding: 0.8rem 1rem;
  border-left: 4px solid var(--accent);
  border-radius: 0 var(--radius-card) var(--radius-card) 0;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const Title = styled.h2`
  margin: 1.25rem 0 0.25rem;
  font-size: 1.05rem;
`

export const Hint = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.8rem;
`
