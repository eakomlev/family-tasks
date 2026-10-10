import styled, { css } from 'styled-components'
import type { ButtonStyleProps } from './types'

// для ссылок используйте as={Link}, стили те же
export const Button = styled.button<ButtonStyleProps>`
  display: block;
  width: 100%;
  padding: 0.85rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  cursor: pointer;

  ${({ $variant }) =>
    $variant === 'primary' &&
    css`
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-text);
    `}

  ${({ $variant }) =>
    $variant === 'danger' &&
    css`
      background: var(--error);
      border-color: var(--error);
      color: var(--on-error);
    `}

  ${({ $variant }) =>
    $variant === 'text' &&
    css`
      width: auto;
      align-self: center;
      padding: 0.25rem;
      border: 0;
      background: none;
      color: var(--accent);
      font-weight: 400;

      &:hover {
        text-decoration: underline;
      }
    `}

  ${({ $inline }) =>
    $inline &&
    css`
      width: auto;
    `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
