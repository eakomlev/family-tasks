import styled from 'styled-components'

export const Hero = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

// смайлик приветствия стоит в первой строке, на одном уровне со значком профиля справа
export const Icon = styled.div`
  margin-top: -0.5rem;
  font-size: 3rem;
  line-height: 1;
`

export const DateLine = styled.p`
  color: var(--muted);
`

// настроение ребёнка на месте значка времени суток: тот же размер, но нажимается
export const MoodButton = styled.button`
  align-self: flex-start;
  margin: -0.5rem 0 0;
  padding: 0;
  border: 0;
  background: none;
  font-size: 3rem;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 0.5rem;
  }
`
