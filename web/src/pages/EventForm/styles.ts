import styled from 'styled-components'

// дата и время в одной строке: поле даты тянется, время рядом кнопкой
export const DateRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;

  > label {
    flex: 1;
    min-width: 0;
  }
`

export const Participants = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  border: 0;

  legend {
    margin-bottom: 0.4rem;
    padding: 0;
    font-weight: 600;
  }
`

export const Mode = styled.div`
  display: flex;
  gap: 0.4rem;
`

export const People = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`

export const PersonChip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.8rem 0.25rem 0.3rem;
  border: 1px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface)')};
  color: var(--text);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.85;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
