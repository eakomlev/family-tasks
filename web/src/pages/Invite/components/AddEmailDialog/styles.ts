import styled from 'styled-components'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  background: rgb(10 12 30 / 0.6);
`

export const Dialog = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: 100%;
  max-width: 24rem;
  padding: 1.2rem;
  border: 1px solid var(--card-border);
  border-radius: 1.4rem;
  background: var(--surface);

  h2 {
    margin: 0;
  }
`

export const ErrorText = styled.p`
  margin: 0;
  color: var(--error);
  font-size: 0.85rem;
`
