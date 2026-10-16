import styled from 'styled-components'

export const ITEM_PX = 40

// кнопка со значением: подпись сверху, время крупно
export const TimeButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  min-width: 5.5rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;

  small {
    color: var(--muted);
    font-size: 0.75rem;
  }

  strong {
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
`

export const Sheet = styled.div`
  width: min(100%, 26rem);
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  border-radius: 1.4rem 1.4rem 0 0;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 -12px 40px rgb(0 0 0 / 0.3);
`

export const Heading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.6rem;

  span {
    color: var(--muted);
  }

  strong {
    color: var(--accent);
    font-size: 1.8rem;
    font-variant-numeric: tabular-nums;
  }
`

export const Quick = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
`

export const QuickChip = styled.button<{ $active: boolean }>`
  padding: 0.35rem 0.7rem;
  border: 1px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 999px;
  background: ${({ $active }) => ($active ? 'var(--accent)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--accent-text)' : 'var(--text)')};
  font: inherit;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
`

// два колеса рядом; полоса по центру показывает выбранное
export const Wheels = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.9rem;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: ${ITEM_PX * 2}px;
    height: ${ITEM_PX}px;
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    pointer-events: none;
  }
`

export const Colon = styled.span`
  align-self: center;
  font-size: 1.6rem;
  font-weight: 700;
`

export const WheelList = styled.div`
  position: relative;
  width: 5rem;
  height: ${ITEM_PX * 5}px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  overscroll-behavior: contain;
  -webkit-mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent);
  mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent);

  &::-webkit-scrollbar {
    display: none;
  }

  /* отступы сверху и снизу позволяют докрутить крайние значения до середины */
  &::before,
  &::after {
    content: '';
    display: block;
    height: ${ITEM_PX * 2}px;
  }
`

export const WheelItem = styled.button<{ $selected: boolean }>`
  display: block;
  width: 100%;
  height: ${ITEM_PX}px;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ $selected }) => ($selected ? 'var(--text)' : 'var(--muted)')};
  font: inherit;
  font-size: ${({ $selected }) => ($selected ? '1.35rem' : '1.1rem')};
  font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
  font-variant-numeric: tabular-nums;
  scroll-snap-align: center;
  cursor: pointer;
`

export const Done = styled.button`
  width: 100%;
  padding: 0.8rem;
  border: 0;
  border-radius: 0.9rem;
  background: var(--accent);
  color: var(--accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`
