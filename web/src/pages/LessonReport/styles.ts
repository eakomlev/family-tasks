import styled from 'styled-components'

export const Subject = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: 1.05rem;
`

export const Grades = styled.div`
  display: flex;
  gap: 0.6rem;
`

// крупные кнопки с оценкой: цвет по привычной шкале (5 зелёная, 2 красная)
export const Grade = styled.button<{ $active: boolean; $tone: string }>`
  flex: 1;
  height: 3.5rem;
  border: 2px solid ${({ $active, $tone }) => ($active ? $tone : 'var(--border)')};
  border-radius: 0.9rem;
  background: ${({ $active, $tone }) => ($active ? `color-mix(in srgb, ${$tone} 22%, var(--surface))` : 'var(--surface)')};
  color: var(--text);
  font: inherit;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Label = styled.span`
  font-weight: 600;
`
