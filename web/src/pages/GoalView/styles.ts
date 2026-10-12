import styled from 'styled-components'

export const Details = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  h1 {
    margin: 0;
    overflow-wrap: anywhere;
  }

  a {
    color: var(--accent);
    overflow-wrap: anywhere;
  }
`

export const PriceLine = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  svg {
    width: 1.6rem;
    height: 1.6rem;
  }
`
