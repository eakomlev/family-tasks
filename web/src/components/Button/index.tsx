import styled, { css } from 'styled-components'
import type { ButtonStyleProps } from './types'

// для ссылок используйте as={Link}, стили те же
export const Button = styled.button<ButtonStyleProps>`
  display: block;
  width: 100%;
  min-height: 3rem;
  padding: 0.75rem 1.4rem;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
  color: var(--text);
  font: inherit;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.12s;

  ${({ $variant }) =>
    $variant === 'primary' &&
    css`
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: var(--accent-shadow);
      color: var(--accent-text);
      font-weight: 900;
    `}

  ${({ $variant }) =>
    $variant === 'lime' &&
    css`
      background: var(--lime);
      border-color: var(--lime);
      box-shadow: none;
      color: var(--on-lime);
      font-weight: 900;
    `}

  ${({ $variant }) =>
    $variant === 'danger' &&
    css`
      background: var(--error);
      border-color: var(--error);
      box-shadow: none;
      color: var(--on-error);
      font-weight: 900;
    `}

  ${({ $variant }) =>
    $variant === 'text' &&
    css`
      width: auto;
      min-height: 0;
      align-self: center;
      padding: 0.25rem;
      border: 0;
      background: none;
      box-shadow: none;
      color: var(--accent);
      font-weight: 700;

      &:hover {
        text-decoration: underline;
      }
    `}

  ${({ $inline }) =>
    $inline &&
    css`
      width: auto;
    `}

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
