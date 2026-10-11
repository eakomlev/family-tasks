import styled from 'styled-components'

// закрывает всю страницу, включая панель табов и плавающие кнопки
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  overflow-y: auto;
  background: var(--bg);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 28rem;

  h2 {
    margin: 0;
  }

  p {
    margin: 0;
    color: var(--muted);
  }
`

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.5rem;
`
