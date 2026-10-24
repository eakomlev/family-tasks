import type { Topic } from '@/realtime/types'

// На какие события сокета подписан мост кэша (`RealtimeBridge`): каждый вид события, который шлёт сервер, должен быть здесь,
// иначе экран по нему не обновится (так «не видно хода соперника в шахматах, пока не обновишь экран»).
export const TOPICS: Topic[] = ['tasks', 'members', 'schedule', 'trainings', 'goals', 'events', 'chat', 'games', 'resync']
