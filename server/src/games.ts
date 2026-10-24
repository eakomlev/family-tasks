import { randomInt } from 'node:crypto'
import { Chess } from 'chess.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { PoolClient } from 'pg'
import { authenticate } from './auth.js'
import { senderLabel } from './chat.js'
import { pool } from './db.js'
import type { PushMessage } from './outbox/contract.js'
import { enqueueToMember } from './outbox/index.js'
import { isViewingChat, publishTo } from './realtime.js'

// Доступные игры. Остальные (шашки, морской бой) пока заглушки на клиенте.
export const GAME_KINDS = ['chess', 'tictactoe'] as const
export type GameKind = (typeof GAME_KINDS)[number]

const GAME_TITLES: Record<GameKind, string> = { chess: 'Шахматы', tictactoe: 'Крестики-нолики' }
// завершённая игра остаётся в списке ещё сутки, чтобы соперник увидел итог
const FINISHED_VISIBLE_HOURS = 24

export interface ChessMove {
  from: string
  to: string
  san: string
  promotion?: string
}

export interface GameResult {
  // null — ничья
  winnerId: string | null
  reason: 'checkmate' | 'stalemate' | 'draw' | 'resign' | 'line'
}

interface GameRow {
  id: string
  family_id: string
  kind: GameKind
  inviter_id: string
  invitee_id: string
  status: 'invited' | 'active' | 'finished' | 'declined' | 'cancelled'
  white_id: string | null
  turn_id: string | null
  // шахматы: moves и fen; крестики-нолики: board (9 знаков по строкам: «X», «O» или «-») и cells (клетки в порядке ходов)
  state: { moves?: ChessMove[]; fen?: string; board?: string; cells?: number[] }
  result: GameResult | null
  created_at: Date
  updated_at: Date
}

export interface GameDto {
  id: string
  kind: GameKind
  status: GameRow['status']
  inviterId: string
  inviteeId: string
  // кто играет белыми (после принятия приглашения)
  whiteId: string | null
  turnId: string | null
  // позиция в нотации FEN
  fen: string
  moves: ChessMove[]
  lastMove: ChessMove | null
  // крестики-нолики: поле из 9 знаков («X» играет тот, кто в whiteId, «O» второй, «-» пусто), клетки по порядку ходов и последняя; у шахмат null и пусто
  board: string | null
  cells: number[]
  lastCell: number | null
  result: GameResult | null
  createdAt: string
  updatedAt: string
}

const START_FEN = new Chess().fen()
const EMPTY_BOARD = '-'.repeat(9)

// Начальное состояние партии нужного вида
const initialState = (kind: GameKind) => (kind === 'chess' ? { fen: START_FEN, moves: [] } : { board: EMPTY_BOARD, cells: [] })

// Тройки клеток, выигрывающие в крестики-нолики
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const hasLine = (board: string, mark: string) => LINES.some((line) => line.every((i) => board[i] === mark))

const toDto = (row: GameRow): GameDto => {
  const moves = row.state.moves ?? []
  const tictactoe = row.kind === 'tictactoe'
  const cells = row.state.cells ?? []
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    inviterId: row.inviter_id,
    inviteeId: row.invitee_id,
    whiteId: row.white_id,
    turnId: row.turn_id,
    fen: tictactoe ? '' : (row.state.fen ?? START_FEN),
    moves,
    lastMove: moves[moves.length - 1] ?? null,
    board: tictactoe ? (row.state.board ?? EMPTY_BOARD) : null,
    cells,
    lastCell: cells[cells.length - 1] ?? null,
    result: row.result,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

// Адрес игры в уведомлениях и ключ «открыта на экране» (тот же канал, что у чатов)
export const gameViewKey = (id: string) => `game-${id}`

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }

// Партия в шахматы из списка ходов (с историей, чтобы работали правила троекратного повторения и 50 ходов)
function replay(moves: ChessMove[]): Chess {
  const chess = new Chess()
  for (const m of moves) chess.move({ from: m.from, to: m.to, promotion: m.promotion })
  return chess
}

interface Member {
  id: string
  name: string
  role: string
  family_id: string
}

export async function gameRoutes(app: FastifyInstance) {
  async function me(req: FastifyRequest, reply: FastifyReply): Promise<Member | null> {
    const member = await authenticate(req)
    if (!member) {
      reply.code(401).send({ error: 'unauthorized' })
      return null
    }
    return member
  }

  const signal = (row: GameRow) => {
    publishTo(row.inviter_id, { type: 'games' })
    publishTo(row.invitee_id, { type: 'games' })
  }

  // Уведомление сопернику, если игра у него сейчас не открыта на экране
  async function notify(row: GameRow, to: string, message: Omit<PushMessage, 'url' | 'tag'>) {
    if (isViewingChat(to, gameViewKey(row.id))) return
    await enqueueToMember(pool, to, { ...message, url: `/games/${row.id}`, tag: `game-${row.id}` })
  }

  const roleOf = async (id: string) => (await pool.query<{ role: string }>('select role from members where id = $1', [id])).rows[0]?.role ?? ''

  // Игра, в которой участвует этот участник, под блокировкой. Чужая и несуществующая одинаково «не найдено».
  async function lockGame(db: PoolClient, member: Member, id: string): Promise<GameRow | null> {
    const { rows } = await db.query<GameRow>(
      'select * from games where id = $1 and family_id = $2 and (inviter_id = $3 or invitee_id = $3) for update',
      [id, member.family_id, member.id],
    )
    return rows[0] ?? null
  }

  // Выполняет действие над игрой в транзакции; reply уже отправлен, если вернулся null
  async function withGame<T>(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, action: (db: PoolClient, game: GameRow, member: Member) => Promise<T | null>) {
    const member = await me(req, reply)
    if (!member) return null
    const db = await pool.connect()
    try {
      await db.query('begin')
      const game = await lockGame(db, member, req.params.id)
      if (!game) {
        await db.query('rollback')
        reply.code(404).send({ error: 'game_not_found' })
        return null
      }
      const out = await action(db, game, member)
      await db.query(out === null ? 'rollback' : 'commit')
      return out
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }
  }

  // Мои игры: приглашения, идущие партии и недавно завершённые
  app.get('/api/games', async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const { rows } = await pool.query<GameRow>(
      `select * from games
       where family_id = $1 and (inviter_id = $2 or invitee_id = $2)
         and (status in ('invited', 'active') or (status = 'finished' and updated_at > now() - make_interval(hours => $3)))
       order by updated_at desc`,
      [member.family_id, member.id, FINISHED_VISIBLE_HOURS],
    )
    return { games: rows.map(toDto) }
  })

  app.get<{ Params: { id: string } }>('/api/games/:id', { schema: { params: idParams } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const { rows } = await pool.query<GameRow>('select * from games where id = $1 and family_id = $2 and (inviter_id = $3 or invitee_id = $3)', [req.params.id, member.family_id, member.id])
    if (!rows[0]) return reply.code(404).send({ error: 'game_not_found' })
    return { game: toDto(rows[0]) }
  })

  // Пригласить участника семьи сыграть
  app.post<{ Body: { kind: GameKind; opponentId: string } }>(
    '/api/games',
    {
      schema: {
        body: {
          type: 'object',
          required: ['kind', 'opponentId'],
          additionalProperties: false,
          properties: { kind: { type: 'string', enum: [...GAME_KINDS] }, opponentId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const { kind, opponentId } = req.body
      if (opponentId === member.id) return reply.code(400).send({ error: 'invalid_opponent' })
      const { rows: opponents } = await pool.query<{ id: string; role: string }>('select id, role from members where id = $1 and family_id = $2', [opponentId, member.family_id])
      if (!opponents[0]) return reply.code(404).send({ error: 'member_not_found' })

      let row: GameRow
      try {
        const { rows } = await pool.query<GameRow>(
          `insert into games (family_id, kind, inviter_id, invitee_id, state) values ($1, $2, $3, $4, $5) returning *`,
          [member.family_id, kind, member.id, opponentId, JSON.stringify(initialState(kind))],
        )
        row = rows[0]
      } catch (err) {
        // уникальный индекс: с этим участником уже идёт такая игра или ждёт ответа приглашение
        if ((err as { code?: string }).code === '23505') {
          const { rows } = await pool.query<GameRow>(
            `select * from games where kind = $1 and status in ('invited', 'active')
               and least(inviter_id, invitee_id) = least($2::uuid, $3::uuid) and greatest(inviter_id, invitee_id) = greatest($2::uuid, $3::uuid)`,
            [kind, member.id, opponentId],
          )
          return reply.code(409).send({ error: 'game_exists', game: rows[0] ? toDto(rows[0]) : null })
        }
        throw err
      }
      signal(row)
      await notify(row, opponentId, { title: `${senderLabel(member, opponents[0].role)} зовёт играть`, body: `${GAME_TITLES[kind]}. Нажмите, чтобы ответить` })
      return reply.code(201).send({ game: toDto(row) })
    },
  )

  // Принять приглашение (только приглашённый): цвета назначаются случайно, первыми ходят белые
  app.post<{ Params: { id: string } }>('/api/games/:id/accept', { schema: { params: idParams } }, async (req, reply) => {
    const updated = await withGame(req, reply, async (db, game, member) => {
      if (game.invitee_id !== member.id) {
        reply.code(403).send({ error: 'forbidden' })
        return null
      }
      if (game.status !== 'invited') {
        reply.code(409).send({ error: 'not_invited' })
        return null
      }
      const white = randomInt(2) === 0 ? game.inviter_id : game.invitee_id
      const { rows } = await db.query<GameRow>(
        `update games set status = 'active', white_id = $2, turn_id = $2, updated_at = now() where id = $1 returning *`,
        [game.id, white],
      )
      return { row: rows[0], member }
    })
    if (!updated) return
    signal(updated.row)
    const mine = updated.row.white_id === updated.row.inviter_id
    const first = updated.row.kind === 'tictactoe' ? (mine ? 'вы ходите первым' : 'соперник ходит первым') : mine ? 'вы ходите белыми' : 'соперник ходит белыми'
    await notify(updated.row, updated.row.inviter_id, {
      title: `${senderLabel(updated.member, await roleOf(updated.row.inviter_id))} принял приглашение`,
      body: `${GAME_TITLES[updated.row.kind]}: ${first}`,
    })
    return { game: toDto(updated.row) }
  })

  // Отклонить приглашение (приглашённый) или отозвать своё (пригласивший)
  for (const [action, status] of [['decline', 'declined'], ['cancel', 'cancelled']] as const) {
    app.post<{ Params: { id: string } }>(`/api/games/:id/${action}`, { schema: { params: idParams } }, async (req, reply) => {
      const updated = await withGame(req, reply, async (db, game, member) => {
        if (game.status !== 'invited') {
          reply.code(409).send({ error: 'not_invited' })
          return null
        }
        // отклонять может только приглашённый, отзывать только пригласивший
        if ((action === 'decline' ? game.invitee_id : game.inviter_id) !== member.id) {
          reply.code(403).send({ error: 'forbidden' })
          return null
        }
        const { rows } = await db.query<GameRow>(`update games set status = $2, updated_at = now() where id = $1 returning *`, [game.id, status])
        return { row: rows[0], member }
      })
      if (!updated) return
      signal(updated.row)
      if (action === 'decline') {
        await notify(updated.row, updated.row.inviter_id, {
          title: `${senderLabel(updated.member, await roleOf(updated.row.inviter_id))} отклонил приглашение`,
          body: GAME_TITLES[updated.row.kind],
        })
      }
      return { game: toDto(updated.row) }
    })
  }

  // Ход в шахматах: from и to клетки вроде «e2», promotion только для превращения пешки (q, r, b, n; по умолчанию ферзь)
  app.post<{ Params: { id: string }; Body: { from: string; to: string; promotion?: string } }>(
    '/api/games/:id/move',
    {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['from', 'to'],
          additionalProperties: false,
          properties: {
            from: { type: 'string', pattern: '^[a-h][1-8]$' },
            to: { type: 'string', pattern: '^[a-h][1-8]$' },
            promotion: { type: 'string', enum: ['q', 'r', 'b', 'n'] },
          },
        },
      },
    },
    async (req, reply) => {
      const result = await withGame(req, reply, async (db, game, member) => {
        if (game.kind !== 'chess') {
          reply.code(400).send({ error: 'wrong_game' })
          return null
        }
        if (game.status !== 'active') {
          reply.code(409).send({ error: 'not_active' })
          return null
        }
        if (game.turn_id !== member.id) {
          reply.code(409).send({ error: 'not_your_turn' })
          return null
        }
        const moves = game.state.moves ?? []
        const chess = replay(moves)
        let made
        try {
          made = chess.move({ from: req.body.from, to: req.body.to, promotion: req.body.promotion ?? 'q' })
        } catch {
          reply.code(400).send({ error: 'illegal_move' })
          return null
        }
        const move: ChessMove = { from: made.from, to: made.to, san: made.san, ...(made.promotion ? { promotion: made.promotion } : {}) }
        const opponent = member.id === game.inviter_id ? game.invitee_id : game.inviter_id

        let outcome: GameResult | null = null
        if (chess.isCheckmate()) outcome = { winnerId: member.id, reason: 'checkmate' }
        else if (chess.isStalemate()) outcome = { winnerId: null, reason: 'stalemate' }
        else if (chess.isDraw()) outcome = { winnerId: null, reason: 'draw' }

        const { rows } = await db.query<GameRow>(
          `update games set state = $2, turn_id = $3, status = $4, result = $5, updated_at = now() where id = $1 returning *`,
          [game.id, JSON.stringify({ fen: chess.fen(), moves: [...moves, move] }), outcome ? null : opponent, outcome ? 'finished' : 'active', outcome ? JSON.stringify(outcome) : null],
        )
        return { row: rows[0], member, opponent, move }
      })
      if (!result) return
      signal(result.row)
      const finished = result.row.result
      await notify(result.row, result.opponent, {
        title: finished ? `${GAME_TITLES[result.row.kind]}: игра окончена` : `${senderLabel(result.member, await roleOf(result.opponent))}: ваш ход`,
        body: finished ? resultText(finished, result.opponent) : `${GAME_TITLES[result.row.kind]}. Ход ${result.move.san}`,
      })
      return { game: toDto(result.row) }
    },
  )

  // Ход в крестики-нолики: cell — номер клетки 0–8 (по строкам слева направо); крестики у того, кто в white_id и ходит первым
  app.post<{ Params: { id: string }; Body: { cell: number } }>(
    '/api/games/:id/place',
    {
      schema: {
        params: idParams,
        body: { type: 'object', required: ['cell'], additionalProperties: false, properties: { cell: { type: 'integer', minimum: 0, maximum: 8 } } },
      },
    },
    async (req, reply) => {
      const result = await withGame(req, reply, async (db, game, member) => {
        if (game.kind !== 'tictactoe') {
          reply.code(400).send({ error: 'wrong_game' })
          return null
        }
        if (game.status !== 'active') {
          reply.code(409).send({ error: 'not_active' })
          return null
        }
        if (game.turn_id !== member.id) {
          reply.code(409).send({ error: 'not_your_turn' })
          return null
        }
        const board = game.state.board ?? EMPTY_BOARD
        const cells = game.state.cells ?? []
        const { cell } = req.body
        if (board[cell] !== '-') {
          reply.code(400).send({ error: 'cell_taken' })
          return null
        }
        const mark = game.white_id === member.id ? 'X' : 'O'
        const next = board.slice(0, cell) + mark + board.slice(cell + 1)
        const opponent = member.id === game.inviter_id ? game.invitee_id : game.inviter_id

        let outcome: GameResult | null = null
        if (hasLine(next, mark)) outcome = { winnerId: member.id, reason: 'line' }
        else if (!next.includes('-')) outcome = { winnerId: null, reason: 'draw' }

        const { rows } = await db.query<GameRow>(
          `update games set state = $2, turn_id = $3, status = $4, result = $5, updated_at = now() where id = $1 returning *`,
          [game.id, JSON.stringify({ board: next, cells: [...cells, cell] }), outcome ? null : opponent, outcome ? 'finished' : 'active', outcome ? JSON.stringify(outcome) : null],
        )
        return { row: rows[0], member, opponent }
      })
      if (!result) return
      signal(result.row)
      const finished = result.row.result
      await notify(result.row, result.opponent, {
        title: finished ? `${GAME_TITLES[result.row.kind]}: игра окончена` : `${senderLabel(result.member, await roleOf(result.opponent))}: ваш ход`,
        body: finished ? resultText(finished, result.opponent) : GAME_TITLES[result.row.kind],
      })
      return { game: toDto(result.row) }
    },
  )

  // Сдаться: победа соперника
  app.post<{ Params: { id: string } }>('/api/games/:id/resign', { schema: { params: idParams } }, async (req, reply) => {
    const result = await withGame(req, reply, async (db, game, member) => {
      if (game.status !== 'active') {
        reply.code(409).send({ error: 'not_active' })
        return null
      }
      const opponent = member.id === game.inviter_id ? game.invitee_id : game.inviter_id
      const outcome: GameResult = { winnerId: opponent, reason: 'resign' }
      const { rows } = await db.query<GameRow>(`update games set status = 'finished', turn_id = null, result = $2, updated_at = now() where id = $1 returning *`, [game.id, JSON.stringify(outcome)])
      return { row: rows[0], opponent, outcome }
    })
    if (!result) return
    signal(result.row)
    await notify(result.row, result.opponent, { title: `${GAME_TITLES[result.row.kind]}: игра окончена`, body: resultText(result.outcome, result.opponent) })
    return { game: toDto(result.row) }
  })
}

// Итог игры глазами участника viewerId
export function resultText(result: GameResult, viewerId: string): string {
  if (result.reason === 'resign') return result.winnerId === viewerId ? 'Соперник сдался. Вы победили!' : 'Вы сдались'
  if (result.reason === 'line') return result.winnerId === viewerId ? 'Три в ряд. Вы победили!' : 'Соперник собрал три в ряд. Вы проиграли'
  if (!result.winnerId) return result.reason === 'stalemate' ? 'Пат. Ничья' : 'Ничья'
  return result.winnerId === viewerId ? 'Мат. Вы победили!' : 'Мат. Вы проиграли'
}
