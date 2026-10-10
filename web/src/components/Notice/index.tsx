import styled, { css } from 'styled-components'
import type { NoticeProps } from './types'

export const Notice = styled.p<NoticeProps>`
  ${({ $tone }) =>
    $tone === 'error' &&
    css`
      color: var(--error);
    `}

  ${({ $tone }) =>
    $tone === 'warning' &&
    css`
      padding: 0.75rem 1rem;
      border-radius: 0.8rem;
      background: var(--warning-bg);
    `}

  ${({ $tone }) =>
    $tone === 'muted' &&
    css`
      color: var(--muted);
    `}
`
