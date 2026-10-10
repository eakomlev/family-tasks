export interface ViewTraining {
  // для React key
  key: string
  title: string
  place?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

export interface TrainingViewListProps {
  trainings: ViewTraining[]
}
