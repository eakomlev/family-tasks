import { Link } from 'react-router-dom'
import styled from 'styled-components'

// ---- шапка страницы (PageHeader): «+» и настройки справа; под ней период с переключателями ----

// «+» просто знак без фона
export const IconLink = styled(Link)`
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: transparent;
  color: var(--accent);

  svg {
    width: 1.8rem;
    height: 1.8rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// настройки: тот же размер, но без заливки
export const SettingsLink = styled(IconLink)`
  color: var(--muted);
  border: 1px solid var(--border);

  svg {
    width: 1.3rem;
    height: 1.3rem;
    stroke-width: 2.2;
  }

  &:hover {
    color: var(--accent);
  }
`

export const Period = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 0;

  h2 {
    margin: 0;
    overflow: hidden;
    font-size: 1.15rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const Arrow = styled.button`
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  cursor: pointer;

  svg {
    width: 1.2rem;
    height: 1.2rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    background: var(--border);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
  }
`

// переключатель День / Неделя / Месяц: плавающая «таблетка» внизу, как в приложении
export const Switch = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
`

// запас под плавающим переключателем
export const SwitchSpace = styled.div`
  height: 4.5rem;
`

// область, листаемая пальцем влево и вправо
export const SwipeArea = styled.div`
  touch-action: pan-y;
`

export const Today = styled.button`
  margin-left: 0.2rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
`

// ---- месяц ----

export const MonthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.15rem;
`

export const WeekdayName = styled.div<{ $weekend: boolean }>`
  padding: 0.2rem 0;
  color: ${({ $weekend }) => ($weekend ? 'var(--cal-holiday)' : 'var(--muted)')};
  font-size: 0.75rem;
  text-align: center;
`

export const Cell = styled.button<{ $today: boolean; $selected: boolean; $outside: boolean; $dayOff: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-height: 3.4rem;
  padding: 0.3rem 0;
  border: 1px solid ${({ $selected }) => ($selected ? 'var(--accent)' : 'transparent')};
  border-radius: 0.7rem;
  background: ${({ $selected }) => ($selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent')};
  color: ${({ $outside, $dayOff }) => ($outside ? 'var(--muted)' : $dayOff ? 'var(--cal-holiday)' : 'var(--text)')};
  opacity: ${({ $outside }) => ($outside ? 0.55 : 1)};
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  > span:first-child {
    display: grid;
    place-items: center;
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 50%;
    background: ${({ $today }) => ($today ? 'var(--accent)' : 'transparent')};
    color: ${({ $today }) => ($today ? 'var(--accent-text)' : 'inherit')};
    font-size: 0.95rem;
    font-weight: ${({ $today }) => ($today ? 700 : 500)};
  }
`

export const Dots = styled.span`
  display: flex;
  gap: 0.18rem;
  min-height: 0.4rem;
`

export const Dot = styled.i<{ $kind: string }>`
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--cal-${({ $kind }) => $kind});
`

// ---- список записей дня ----

export const DaySection = styled.section<{ $today?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: ${({ $today }) => ($today ? '0.6rem' : '0')};
  border-radius: 0.9rem;
  background: ${({ $today }) => ($today ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent')};

  h2 {
    margin: 0;
    font-size: 1rem;
  }
`

export const DayHeading = styled.button`
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
`

export const Empty = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled.li<{ $kind: string }>`
  position: relative;
  border: 1px solid var(--card-border);
  border-left: 4px solid var(--cal-${({ $kind }) => $kind});
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);

  > a,
  > div {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.7rem;
    color: inherit;
    text-decoration: none;
  }

  > a:focus-visible {
    outline: 2px solid var(--accent);
    border-radius: 0.8rem;
  }
`

export const Emoji = styled.span`
  flex: none;
  font-size: 1.2rem;
`

export const Info = styled.span<{ $done?: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  strong {
    overflow: hidden;
    font-weight: 600;
    text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--muted);
    font-size: 0.8rem;
  }
`

export const When = styled.span`
  flex: none;
  color: var(--muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
`

export const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.9rem;
  color: var(--muted);
  font-size: 0.8rem;

  span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
`
