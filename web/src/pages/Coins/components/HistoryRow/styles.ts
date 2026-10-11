import styled from 'styled-components'

export const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface);
  list-style: none;
`

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`

export const Reason = styled.span<{ $empty: boolean }>`
  color: ${({ $empty }) => ($empty ? 'var(--muted)' : 'var(--text)')};
  overflow-wrap: anywhere;
`

export const Meta = styled.span`
  color: var(--muted);
  font-size: 0.85rem;
`

// сумма: зелёная у начисления, красная у списания
export const Amount = styled.strong<{ $negative: boolean }>`
  flex: none;
  color: ${({ $negative }) => ($negative ? 'var(--error)' : 'var(--success)')};
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
`
