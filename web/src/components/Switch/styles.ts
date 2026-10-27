import styled from 'styled-components'

export const Label = styled.label<{ $disabled: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  font-weight: 700;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`

export const Text = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;

  small {
    display: block;
    margin-top: 0.15rem;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 400;
  }
`

export const Track = styled.span`
  position: relative;
  flex: none;
  width: 3rem;
  height: 1.75rem;
  border-radius: 999px;
  background: var(--track, var(--border));
  transition: background 0.18s;
`

export const Thumb = styled.span`
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.18s;
`

// сам флажок скрыт, но остаётся доступным с клавиатуры и для скринридеров
export const Input = styled.input`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;

  &:checked + ${Track} {
    background: var(--accent);
  }

  &:checked + ${Track} ${Thumb} {
    transform: translateX(1.25rem);
  }

  &:focus-visible + ${Track} {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    & + ${Track}, & + ${Track} ${Thumb} {
      transition: none;
    }
  }
`
