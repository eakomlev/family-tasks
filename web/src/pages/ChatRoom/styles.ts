import styled from 'styled-components'

// страница чата: переписка растягивается, поле ввода прижато к панели табов
export const Room = styled.main`
  max-width: 28rem;
  min-height: calc(100dvh - var(--tabbar-height));
  margin: 0 auto;
  padding: 1rem 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

export const Header = styled.header`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  /* справа вверху лежит значок профиля */
  padding-right: 3rem;

  h1 {
    margin: 0;
    font-size: 1.25rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

export const FamilyIcon = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
`

export const Feed = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 0.5rem;
`

export const DayLabel = styled.div`
  align-self: center;
  margin: 0.6rem 0 0.2rem;
  padding: 0.15rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 16%, transparent);
  color: var(--muted);
  font-size: 0.75rem;
`

export const Empty = styled.p`
  margin: auto;
  color: var(--muted);
  text-align: center;
`
