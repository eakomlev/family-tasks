import styled from 'styled-components'

// сетка квадратных превью по три в ряд
export const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Thumb = styled.button`
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0.4rem;
  background: var(--surface);
  cursor: pointer;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Sentinel = styled.div`
  height: 1px;
`
