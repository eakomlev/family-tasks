export interface PendingReviewProps {
  // показывать только задания этого исполнителя (фильтр на странице «Задания»); null или не задан — все
  assigneeId?: string | null
  // сколько заданий показано (0, если блок пуст): страница по нему решает, писать ли «заданий нет»
  onCount?: (count: number) => void
}
