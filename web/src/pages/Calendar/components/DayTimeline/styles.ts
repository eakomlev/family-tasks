import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components'

// высота часа и ширина колонки с подписями времени; от них считаются положения блоков
export const HOUR_REM = 3.6
export const LABEL_REM = 2.9

export const AllDay = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-bottom: 0.5rem;
`

// окно с прокруткой: сутки длиннее экрана, поэтому полоса листается внутри страницы
export const Scroller = styled.div`
  position: relative;
  height: max(22rem, calc(100dvh - 20rem));
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface);
`

export const Strip = styled.div`
  position: relative;
  height: ${HOUR_REM * 24}rem;
`

export const Hour = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: ${HOUR_REM}rem;
  border-top: 1px solid var(--border);

  span {
    position: absolute;
    top: 0.2rem;
    left: 0;
    width: ${LABEL_REM}rem;
    color: var(--muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  /* середина часа тонкой пунктирной линией */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: ${LABEL_REM}rem;
    right: 0;
    border-top: 1px dashed color-mix(in srgb, var(--border) 60%, transparent);
  }
`

// область блоков правее подписей
export const Lane = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${LABEL_REM}rem;
  right: 0.35rem;
`

const blockCss = css<{ $kind: string }>`
  position: absolute;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  padding: 0.2rem 0.45rem;
  border-left: 4px solid var(--cal-${({ $kind }) => $kind});
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--cal-${({ $kind }) => $kind}) 20%, var(--surface));
  color: var(--text);
  font-size: 0.85rem;
  line-height: 1.25;
  text-decoration: none;

  strong {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: var(--muted);
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    z-index: 3;
  }
`

// блок записи: ссылка, а у записи без ссылки обычный блок
export const Block = styled(Link)<{ $kind: string }>`
  ${blockCss}
`

export const PlainBlock = styled.div<{ $kind: string }>`
  ${blockCss}
`

// красная линия «сейчас»
export const NowLine = styled.div`
  position: absolute;
  z-index: 2;
  left: ${LABEL_REM - 0.3}rem;
  right: 0;
  height: 0;
  border-top: 2px solid var(--cal-holiday);
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: -0.35rem;
    left: -0.1rem;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--cal-holiday);
  }
`
