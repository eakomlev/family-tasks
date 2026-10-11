import styled from 'styled-components'

export const Total = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem 0;
  text-align: center;

  svg {
    width: 3.5rem;
    height: 3.5rem;
  }

  strong {
    font-size: 2.2rem;
    font-variant-numeric: tabular-nums;
  }

  span {
    color: var(--muted);
  }
`

export const List = styled.ul`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
`

// сторож в конце списка: когда он появляется на экране, подгружается следующая страница
export const Sentinel = styled.div`
  height: 1px;
`
