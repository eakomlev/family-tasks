import styled from 'styled-components'

export const Profile = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0;
  text-align: center;

  h2 {
    margin: 0.3rem 0 0;
    font-size: 1.65rem;
    line-height: 1.15;
  }

  p {
    margin: 0;
    color: var(--muted);
  }
`

export const Role = styled.p`
  color: var(--accent) !important;
  font-weight: 700;
`

export const GroupIcon = styled.span`
  display: grid;
  place-items: center;
  width: 6rem;
  height: 6rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);

  svg {
    width: 2.8rem;
    height: 2.8rem;
    fill: currentColor;
  }
`

// блок действий: строки с значком, разделитель между ними
export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;

  & > * + * {
    border-top: 1px solid var(--border);
  }
`

export const ActionRow = styled.button`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 3.4rem;
  padding: 0 1rem;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  svg {
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  span {
    flex: 1;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`

// переключатель: бегунок переезжает
export const Switch = styled.span<{ $on: boolean }>`
  position: relative;
  flex: none !important;
  width: 2.8rem;
  height: 1.6rem;
  border-radius: 999px;
  background: ${({ $on }) => ($on ? 'var(--accent)' : 'var(--track)')};
  transition: background 0.2s;

  &::after {
    content: '';
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: #fff;
    transform: translateX(${({ $on }) => ($on ? '1.2rem' : '0')});
    transition: transform 0.2s;
  }
`

export const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  input {
    flex: 1;
    min-width: 0;
  }
`

// две вкладки равной ширины, подложка плавно переезжает под выбранную
export const Tabs = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 0.2rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--surface);
`

export const Slider = styled.span<{ $index: number }>`
  position: absolute;
  top: 0.2rem;
  bottom: 0.2rem;
  left: 0.2rem;
  width: calc(50% - 0.2rem);
  border-radius: 999px;
  background: var(--accent);
  transform: translateX(${({ $index }) => $index * 100}%);
  transition: transform 0.2s ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  z-index: 1;
  min-height: 2.4rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: ${({ $active }) => ($active ? 'var(--accent-text)' : 'var(--text)')};
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

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

export const Rows = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const LinkRow = styled.a`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--card-border);
  border-radius: 0.9rem;
  background: var(--surface);
  color: var(--accent);
  font-weight: 700;
  overflow-wrap: anywhere;
  text-decoration: none;

  small {
    color: var(--muted);
    font-weight: 400;
  }
`

export const Found = styled.li`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--card-border);
  border-radius: 0.9rem;
  background: var(--surface);
  overflow-wrap: anywhere;
  white-space: pre-wrap;

  small {
    color: var(--muted);
  }
`

export const Sentinel = styled.div`
  height: 1px;
`
