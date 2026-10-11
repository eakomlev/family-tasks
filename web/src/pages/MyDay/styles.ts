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
