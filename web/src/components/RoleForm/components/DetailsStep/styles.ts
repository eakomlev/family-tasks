import styled from 'styled-components'

export const Roles = styled.fieldset`
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  border: 0;

  legend {
    margin-bottom: 0.6rem;
    padding: 0;
    font-weight: 600;
  }
`

export const RoleCard = styled.label<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 2px solid ${({ $selected }) => ($selected ? 'var(--accent)' : 'var(--border)')};
  border-radius: 0.8rem;
  background: var(--surface);
  cursor: pointer;

  input {
    accent-color: var(--accent);
  }
`
