import styled from 'styled-components'

// карточка факта дня вверху «Моего дня»
export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
`

export const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

export const Emoji = styled.span`
  font-size: 2.2rem;
  line-height: 1;
`

export const Label = styled.span`
  display: block;
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

export const Title = styled.h2`
  margin: 0;
  font-size: 1.15rem;
`

export const Text = styled.p`
  margin: 0;
  line-height: 1.45;
`
