import { useNavigate } from 'react-router-dom'
import type { Task } from '@/api'
import { ActionSheet } from '@/components/ActionSheet'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { toApiError } from '@/store/api'
import { useDeleteTaskMutation } from '@/store/tasks'

// Меню задания по долгому нажатию (только у автора): «Изменить» и «Удалить» (с подтверждением).
// Отдельным компонентом, чтобы карточке не нужны были подтверждения и кэш данных, пока меню закрыто.
export function TaskMenu({ task, onClose }: { task: Task; onClose: () => void }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [deleteTask] = useDeleteTaskMutation()

  return (
    <ActionSheet
      title={task.title}
      onClose={onClose}
      actions={[
        { key: 'edit', label: 'Изменить', onSelect: () => navigate(`/tasks/${task.id}/edit`) },
        {
          key: 'delete',
          label: 'Удалить',
          danger: true,
          onSelect: async () => {
            const ok = await confirm({ title: 'Удалить задание?', message: task.title, confirmLabel: 'Удалить', danger: true })
            if (ok) await deleteTask(task.id).unwrap().catch(toApiError)
          },
        },
      ]}
    />
  )
}
