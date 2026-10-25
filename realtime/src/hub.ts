import type { WebSocket } from 'ws'

export interface Client {
  // номер соединения в таблице realtime_viewing
  id: string
  socket: WebSocket
  familyId: string
  memberId: string
  tokenHash: string
  alive: boolean
  // какой чат открыт на экране этого устройства (с точки зрения участника), null — никакой
  viewing: string | null
  // записи о чате идут по очереди: вход и выход из чата не должны перегонять друг друга
  work: Promise<unknown>
}

// Если клиент не успевает читать (мёртвая сеть), копить в памяти бесконечно нельзя: соединение рвём, клиент переподключится и обновится сам.
const MAX_BUFFERED_BYTES = 1_000_000

// Подключённые клиенты с указателями по семье, участнику и сессии: рассылка ищет адресатов, а не перебирает всех.
export class Hub {
  private readonly all = new Set<Client>()
  private readonly byFamily = new Map<string, Set<Client>>()
  private readonly byMember = new Map<string, Set<Client>>()
  private readonly byToken = new Map<string, Set<Client>>()

  get size() {
    return this.all.size
  }

  clients(): Iterable<Client> {
    return this.all
  }

  ofMember(memberId: string): Client[] {
    return [...(this.byMember.get(memberId) ?? [])]
  }

  add(client: Client) {
    this.all.add(client)
    index(this.byFamily, client.familyId, client)
    index(this.byMember, client.memberId, client)
    index(this.byToken, client.tokenHash, client)
  }

  remove(client: Client) {
    this.all.delete(client)
    unindex(this.byFamily, client.familyId, client)
    unindex(this.byMember, client.memberId, client)
    unindex(this.byToken, client.tokenHash, client)
  }

  // Сообщение всем устройствам семьи (в том числе того, кто его вызвал: его другие устройства тоже должны обновиться).
  toFamily(familyId: string, text: string) {
    for (const client of this.byFamily.get(familyId) ?? []) send(client, text)
  }

  toMember(memberId: string, text: string) {
    for (const client of this.byMember.get(memberId) ?? []) send(client, text)
  }

  closeSession(tokenHash: string, code: number, reason: string) {
    for (const client of [...(this.byToken.get(tokenHash) ?? [])]) client.socket.close(code, reason)
  }

  closeAll(code: number, reason: string) {
    for (const client of this.all) client.socket.close(code, reason)
  }
}

export function send(client: Client, text: string) {
  const { socket } = client
  if (socket.readyState !== socket.OPEN) return
  if (socket.bufferedAmount > MAX_BUFFERED_BYTES) return socket.terminate()
  socket.send(text)
}

function index(map: Map<string, Set<Client>>, key: string, client: Client) {
  const set = map.get(key)
  if (set) set.add(client)
  else map.set(key, new Set([client]))
}

function unindex(map: Map<string, Set<Client>>, key: string, client: Client) {
  const set = map.get(key)
  if (!set) return
  set.delete(client)
  if (set.size === 0) map.delete(key)
}
