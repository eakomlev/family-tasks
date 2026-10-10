import styled from 'styled-components'
import { Page } from '@/components/Page'

export const WelcomePage = styled(Page)`
  justify-content: space-between;
  text-align: center;
`

export const Hero = styled.div`
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  p {
    color: var(--muted);
  }
`

export const Logo = styled.div`
  width: 5rem;
  height: 5rem;
  display: grid;
  place-items: center;
  border-radius: 1.4rem;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 2.6rem;
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: env(safe-area-inset-bottom);
`
