import styled from 'styled-components'

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 0.92);
  padding: calc(3.5rem + env(safe-area-inset-top)) 0 env(safe-area-inset-bottom);
`

export const Player = styled.video`
  display: block;
  max-width: 100%;
  max-height: 100%;
  background: #000;
`

export const CloseButton = styled.button`
  position: absolute;
  top: calc(0.8rem + env(safe-area-inset-top));
  right: 0.8rem;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.16);
  color: #fff;
  cursor: pointer;

  svg {
    width: 1.4rem;
    height: 1.4rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
  }
`
