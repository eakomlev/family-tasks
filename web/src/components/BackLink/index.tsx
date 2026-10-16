import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { BACK_STATE } from '@/lib/useSlideIn'

// ссылка «назад»: страница, на которую возвращаемся, не выезжает справа
export const BackLink = styled(Link).attrs({ state: BACK_STATE })`
  align-self: flex-start;
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
