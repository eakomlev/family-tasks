export interface CelebrationProps {
  // название выполненного задания
  title: string
  // сколько монет получил исполнитель за это задание (показываем, если больше 0)
  reward?: number
  onClose: () => void
}
