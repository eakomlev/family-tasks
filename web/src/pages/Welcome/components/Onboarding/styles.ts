import styled from 'styled-components'

export const Root = styled.div`
  position: relative;
  z-index: 1;
  max-width: 28rem;
  height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
`

export const TopBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 0.9rem 1rem 0;
  min-height: 2.9rem;
`

export const Skip = styled.button`
  padding: 0.35rem 0.6rem;
  border: 0;
  border-radius: 0.6rem;
  background: none;
  color: var(--accent);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`

export const Track = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const SlideView = styled.section`
  flex: 0 0 100%;
  min-width: 0;
  min-height: 0;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  padding: 0.5rem 1.5rem 0;
  text-align: center;

  h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  p {
    color: var(--muted);
    max-width: 21rem;
  }
`

// Экран телефона: рамка, скругление, картинка обрезается по верху
export const Phone = styled.div`
  flex: 1;
  min-height: 0;
  max-height: 31rem;
  aspect-ratio: 750 / 1100;
  max-width: 100%;
  overflow: hidden;
  border: 0.45rem solid var(--text);
  border-radius: 2rem;
  background: var(--surface);
  box-shadow: 0 24px 40px -20px var(--glass-shade);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
`

export const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom));
`

export const Dots = styled.div`
  display: flex;
  gap: 0.5rem;
`

export const Dot = styled.button<{ $active: boolean }>`
  width: ${({ $active }) => ($active ? '1.6rem' : '0.55rem')};
  height: 0.55rem;
  padding: 0;
  border: 0;
  border-radius: 0.3rem;
  background: ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  cursor: pointer;
  transition: width 0.2s, background 0.2s;
`
