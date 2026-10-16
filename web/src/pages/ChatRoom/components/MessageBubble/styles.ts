import styled from 'styled-components'

export const Wrap = styled.div<{ $mine: boolean }>`
  /* долгое нажатие открывает окно реакции: системное выделение текста и меню на телефоне отключены для всего сообщения */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`

export const Bubble = styled.div<{ $mine: boolean; $interactive?: boolean; $photoColumns?: number }>`
  max-width: 82%;
  /* с фото ширина задана, а не определяется содержимым: плитки занимают всю ширину пузыря и не вылезают за него */
  ${({ $photoColumns }) => ($photoColumns ? `width: min(82%, ${$photoColumns === 1 ? '17rem' : '21rem'});` : '')}
  padding: 0.3rem 0.6rem;
  border-radius: 1rem;
  ${({ $mine }) => ($mine ? 'border-bottom-right-radius: 0.3rem;' : 'border-bottom-left-radius: 0.3rem;')}
  background: ${({ $mine }) => ($mine ? 'var(--accent)' : 'var(--surface)')};
  color: ${({ $mine }) => ($mine ? 'var(--accent-text)' : 'var(--text)')};
  border: 1px solid ${({ $mine }) => ($mine ? 'var(--accent)' : 'var(--border)')};
  ${({ $interactive }) =>
    $interactive
      ? `cursor: default;
  /* долгое нажатие открывает окно реакции, поэтому системное выделение и меню на телефоне отключены */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  &:hover { border-color: var(--accent); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
      : ''}
`

export const Sender = styled.div`
  margin-bottom: 0.1rem;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
`

// Фото сообщения. Одно показывается по своим пропорциям, несколько плитками. Ширина пузыря задаётся фото, поэтому у него есть минимум.
export const Photos = styled.div<{ $columns: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  gap: 0.2rem;
  margin: 0.1rem -0.35rem 0.25rem;
`

export const PhotoButton = styled.button<{ $ratio?: number }>`
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0.7rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  aspect-ratio: ${({ $ratio }) => $ratio ?? 1};
  max-height: 22rem;
  cursor: zoom-in;
  -webkit-tap-highlight-color: transparent;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// переносы строк из сообщения сохраняются
export const Text = styled.div`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  margin-top: 0.1rem;
`

export const Time = styled.span`
  font-size: 0.7rem;
  opacity: 0.7;
`

// Реакции и монеты слегка заезжают на нижний край пузыря и сдвинуты внутрь от его угла, как в популярных мессенджерах
export const Extras = styled.div<{ $mine: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  max-width: 82%;
  margin: -0.6rem ${({ $mine }) => ($mine ? '0.7rem' : '0')} 0.15rem ${({ $mine }) => ($mine ? '0' : '0.7rem')};
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`

export const ReactionChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--bg);
  font-size: 0.95rem;

  small {
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
`

export const CoinPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.55rem 0.1rem 0.3rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--bg);
  font-size: 0.85rem;
  font-weight: 700;

  svg {
    width: 1.1rem;
    height: 1.1rem;
  }
`

// файлы сообщения: строка со значком, именем и размером; нажатие сохраняет файл
export const Files = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.1rem 0 0.25rem;
`

export const FileButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: 0.7rem;
  background: rgb(0 0 0 / 0.08);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-touch-callout: none;

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 1px;
  }

  svg {
    flex: none;
    width: 1.6rem;
    height: 1.6rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`

export const FileInfo = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;

  strong {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    opacity: 0.75;
    font-size: 0.75rem;
  }
`
