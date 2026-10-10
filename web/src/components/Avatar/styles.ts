import styled from 'styled-components'

export const Circle = styled.span<{ $color: string; $size: string }>`
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  display: inline-grid;
  place-items: center;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  color: #fff;
  font-size: calc(${({ $size }) => $size} * 0.45);
  font-weight: 600;
  line-height: 1;
  user-select: none;
`

export const Photo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`
