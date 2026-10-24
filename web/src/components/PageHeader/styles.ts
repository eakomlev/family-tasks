import styled from 'styled-components'
import { BackLink } from '@/components/BackLink'

// Шапка вложенной страницы, как в приложении: стрелка «назад» и заголовок на одной строке, справа необязательное действие.
// Справа вверху оболочка рисует баланс монет ребёнка, поэтому без своего действия шапка оставляет ему место (--topbar-reserve).
export const Bar = styled.header<{ $reserve: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 2.75rem;
  padding-right: ${({ $reserve }) => ($reserve ? 'var(--topbar-reserve, 0rem)' : '0')};

  h1 {
    flex: 1;
    min-width: 0;
    font-size: 1.5rem;
    overflow-wrap: anywhere;
  }
`

export const Back = styled(BackLink)`
  flex: none;
  display: grid;
  place-items: center;
  align-self: center;
  width: 2.5rem;
  height: 2.5rem;
  margin-left: -0.5rem;
  border-radius: 50%;
  color: var(--text);

  svg {
    width: 1.6rem;
    height: 1.6rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
  }
`

export const Right = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.6rem;
`

// заголовок внутри страницы (название задания, события): выглядит как прежний h1, но уровнем ниже, потому что h1 теперь в шапке
export const BodyTitle = styled.h2`
  margin: 0;
  font-size: 1.65rem;
  font-weight: 900;
  line-height: 1.15;
  overflow-wrap: anywhere;
`
