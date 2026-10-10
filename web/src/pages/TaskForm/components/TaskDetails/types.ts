import type { Member, Task } from '@/api'

export interface TaskDetailsProps {
  task: Task
  author?: Member
  assignee?: Member
}
