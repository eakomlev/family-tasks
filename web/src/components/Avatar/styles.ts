import styled from 'styled-components'

export const Circle = styled.span<{ $color: string; $size: string }>`
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  color: #fff;
  font-size: calc(${({ $size }) => $size} * 0.45);
  font-weight: 600;
  line-height: 1;
  user-select: none;
`
