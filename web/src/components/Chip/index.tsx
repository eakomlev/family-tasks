import styled from 'styled-components'
import type { ChipProps } from './types'

// маленькая кнопка-«таблетка» для фильтров и выбора дней; активная подсвечена
export const Chip = styled.button<ChipProps>`
  padding: 0.4rem 0.85rem;
  border: 1px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'var(--accent)' : 'var(--surface)')};
  color: ${({ $active }) => ($active ? 'var(--accent-text)' : 'var(--text)')};
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
