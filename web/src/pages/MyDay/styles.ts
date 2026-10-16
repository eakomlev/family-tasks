import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

// календарь стоит в первой строке слева, на одном уровне со значком профиля справа
export const CalendarLink = styled(Link)`
  align-self: flex-start;
  display: block;
  width: 3rem;
  height: 3rem;
  margin-top: -0.5rem;
  border-radius: 0.8rem;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
`

// значок времени суток слева, приветствие, справа настроение ребёнка
export const GreetingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  /* отступ от значка календаря над приветствием */
  margin-top: 0.75rem;

  h1 {
    flex: 1;
    min-width: 0;
    margin: 0;
  }
`

export const Icon = styled.div`
  flex: none;
  font-size: 2.2rem;
  line-height: 1;
`

export const DateLine = styled.p`
  color: var(--muted);
`

// настроение ребёнка на месте значка времени суток: тот же размер, но нажимается
export const MoodButton = styled.button`
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  font-size: 2.2rem;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 0.5rem;
  }
`
