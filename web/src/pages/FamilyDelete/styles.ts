import styled from 'styled-components'

// что будет удалено: список с понятными пунктами
export const Losses = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0 0 0 1.2rem;
  line-height: 1.4;
`

export const Farewell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding-top: 2rem;
  text-align: center;

  p {
    margin: 0;
    max-width: 22rem;
  }
`

export const Heart = styled.div`
  font-size: 3.5rem;
  line-height: 1;
`
