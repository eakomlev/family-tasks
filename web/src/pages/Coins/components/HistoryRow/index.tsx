import { formatAmount } from '../../utils'
import { Amount, Body, Meta, Reason, Row } from './styles'
import type { HistoryRowProps } from './types'

// строка истории: за что, когда и кем, справа сколько
export function HistoryRow({ entry, meta }: HistoryRowProps) {
  return (
    <Row>
      <Body>
        <Reason $empty={entry.reason === ''}>{entry.reason || 'Без описания'}</Reason>
        <Meta>{meta}</Meta>
      </Body>
      <Amount $negative={entry.amount < 0} aria-label={`${entry.amount > 0 ? 'Начислено' : 'Списано'}: ${Math.abs(entry.amount)}`}>
        {formatAmount(entry.amount)}
      </Amount>
    </Row>
  )
}
