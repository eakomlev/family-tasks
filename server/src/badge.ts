import type { Pool, PoolClient } from 'pg'
import { directKey } from './chatKey.js'

type Db = Pick<Pool | PoolClient, 'query'>

// Число на значке приложения: непрочитанные сообщения во всех чатах участника, кроме отключённых (mute) и убранных в архив.
// Считается так же, как в списке чатов (`GET /api/chats`: непрочитанным считается всё, что новее последнего прочтения чата
// или появления в семье и написано не им самим); клиенты считают то же по своему списку чатов (`appBadgeCount`).
export async function unreadBadge(db: Db, memberId: string): Promise<number> {
  const { rows: me } = await db.query<{ familyId: string; createdAt: Date }>('select family_id as "familyId", created_at as "createdAt" from members where id = $1', [memberId])
  if (!me[0]) return 0
  const { rows: others } = await db.query<{ id: string }>('select id from members where family_id = $1 and id <> $2', [me[0].familyId, memberId])
  const directKeys = others.map((o) => directKey(memberId, o.id))

  const { rows } = await db.query<{ count: string }>(
    `select count(*) as count
     from messages m
     left join chat_reads r on r.member_id = $2 and r.chat_key = m.chat_key
     where m.family_id = $1 and m.sender_id <> $2
       and m.created_at > coalesce(r.last_read_at, $3)
       and (
         m.chat_key = 'family'
         or m.chat_key = any($4)
         or m.chat_key in (
           select 'event:' || e.id from events e
           where e.family_id = $1
             and (e.all_family or e.author_id = $2 or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = $2))
         )
       )
       and not exists (select 1 from chat_mutes cm where cm.member_id = $2 and cm.chat_key = m.chat_key)
       and not exists (select 1 from chat_archives ca where ca.member_id = $2 and ca.chat_key = m.chat_key)`,
    [me[0].familyId, memberId, me[0].createdAt, directKeys],
  )
  return Number(rows[0]?.count ?? 0)
}
