// Демо-семья для ручной проверки приложения: мама, папа и двое детей с расписанием, тренировками и заданиями.
//
//   npm run seed                       создать демо-семью (прежнюю демо-семью удалить) и показать, как войти
//   npm run seed -- --json             то же, но вывести только JSON: id и токены сессий всех участников
//   npm run seed -- --snippet Миша     JS-код для консоли браузера: войти под этим участником. Семью не пересоздаёт,
//                                      берёт уже созданную и выдаёт свежую сессию (прежние входы остаются рабочими)
//   npm run seed -- --existing --json  JSON со свежими сессиями уже созданной семьи (без пересоздания)
//   npm run seed -- --force            разрешить запуск не на локальной БД (осторожно)
//
// Нужна запущенная БД (npm run dev:infra) и .env с DATABASE_URL. Демо-участники узнаются по адресам
// @demo.test: при каждом запуске только такие семьи удаляются и создаются заново, остальные данные не трогаются.
// У Миши день рождения сегодня (удобно проверять поздравления: cd scheduler && npm run notify:tick -- 10:05 --reset).
import { createSession } from '../src/auth.js'
import { familyCode, inviteCode } from '../src/codes.js'
import { pool } from '../src/db.js'
import { migrate } from '../src/migrate.js'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const valueOf = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const asJson = flag('--json')
const snippetFor = valueOf('--snippet')
// --snippet работает с уже созданной семьёй, --existing включает то же для остальных режимов
const useExisting = flag('--existing') || snippetFor !== undefined

const DEMO_DOMAIN = 'demo.test'
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'db']

// --- защита от запуска на боевой базе
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Не задан DATABASE_URL (нужен .env в корне проекта).')
  process.exit(1)
}
const host = new URL(databaseUrl).hostname
if (!LOCAL_HOSTS.includes(host) && !flag('--force')) {
  console.error(`БД на хосте «${host}» не похожа на локальную, демо-данные не создаю. Если это точно то, что нужно, добавьте --force.`)
  process.exit(1)
}

// --- даты относительно сегодняшнего дня (по часовому поясу этого компьютера), чтобы демо выглядело «живым»
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = new Date()
const daysFromToday = (n: number) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n))

try {
  await migrate(databaseUrl)
} catch {
  console.error('Не удалось подключиться к БД. Запустите её: npm run dev:infra')
  process.exit(1)
}

interface Person { name: string; email: string; role: 'mama' | 'papa' | 'child'; owner: boolean; birthDate: string }
type Members = Record<string, { id: string; token: string; role: string; email: string }>

// у Миши день рождения сегодня (ему 12): удобно проверять поздравления
const birthdayToday = `${today.getFullYear() - 12}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

const people: Person[] = [
  { name: 'Лена', email: `lena@${DEMO_DOMAIN}`, role: 'mama', owner: true, birthDate: '1985-05-12' },
  { name: 'Игорь', email: `igor@${DEMO_DOMAIN}`, role: 'papa', owner: false, birthDate: '1983-11-03' },
  { name: 'Миша', email: `misha@${DEMO_DOMAIN}`, role: 'child', owner: false, birthDate: birthdayToday },
  { name: 'Аня', email: `anya@${DEMO_DOMAIN}`, role: 'child', owner: false, birthDate: '2018-03-21' },
]

// Берёт уже созданную демо-семью и выдаёт свежую сессию участнику `only` (или всем, если имя не задано).
async function loadExisting(only?: string): Promise<{ family: { id: string; code: string }; members: Members }> {
  const { rows } = await pool.query(
    `select f.id as family_id, f.code, m.id, m.name, m.role, m.email
     from members m join families f on f.id = m.family_id
     where m.email like $1 order by m.created_at`,
    [`%@${DEMO_DOMAIN}`],
  )
  if (rows.length === 0) {
    console.error('Демо-семьи ещё нет. Сначала создайте её: npm run seed')
    process.exit(1)
  }
  const members: Members = {}
  for (const r of rows) {
    // сессию создаём только тому, кому она нужна, остальным токен пустой
    const token = only === undefined || only === r.name ? await createSession(pool, r.id) : ''
    members[r.name] = { id: r.id, token, role: r.role, email: r.email }
  }
  return { family: { id: rows[0].family_id, code: rows[0].code }, members }
}

async function createDemo(): Promise<{ family: { id: string; code: string }; members: Members }> {
  // --- удаляем прежнюю демо-семью
  await pool.query(
    `delete from families where id in (select family_id from members where email like $1)`,
    [`%@${DEMO_DOMAIN}`],
  )

  // --- семья и участники
  const { rows: [family] } = await pool.query(`insert into families (code) values ($1) returning id, code`, [familyCode()])

  const members: Members = {}
  for (const p of people) {
    const { rows } = await pool.query(
      `insert into members (family_id, name, email, role, is_owner, birth_date) values ($1, $2, $3, $4, $5, $6) returning id`,
      [family.id, p.name, p.email, p.role, p.owner, p.birthDate],
    )
    members[p.name] = { id: rows[0].id, token: await createSession(pool, rows[0].id), role: p.role, email: p.email }
  }
  const id = (name: string) => members[name].id

  // Монеты детей: длинная история начислений и списаний (чтобы проверять прокрутку), авторы родители, часть записей от системы.
  const coinReasons: [string, number][] = [
    ['Помыл посуду', 10], ['Убрал в комнате', 15], ['Сходил в магазин', 20], ['Хорошая оценка по математике', 30],
    ['Помог с ужином', 10], ['Вынес мусор', 5], ['Купил мороженое', -10], ['Билеты в кино', -15], ['Новая игрушка', -20],
  ]
  const coinHistory: Record<string, number> = { Миша: 42, Аня: 14 }
  for (const [name, count] of Object.entries(coinHistory)) {
    await pool.query(
      `insert into coin_transactions (member_id, amount, reason, created_at, created_by) values ($1, 100, 'Стартовый баланс', now() - interval '90 days', null)`,
      [id(name)],
    )
    for (let i = 0; i < count; i++) {
      const [reason, amount] = coinReasons[(i * 5 + name.length) % coinReasons.length]
      const author = i % 9 === 8 ? null : id(i % 2 === 0 ? 'Лена' : 'Игорь')
      await pool.query(
        `insert into coin_transactions (member_id, amount, reason, created_at, created_by)
         values ($1, $2, $3, now() - make_interval(mins => $4), $5)`,
        [id(name), amount, reason, i * 2160 + (i % 5) * 120, author],
      )
    }
  }

  // приглашение владельца, как после создания семьи
  await pool.query(`insert into invites (family_id, code, expires_at) values ($1, $2, now() + interval '7 days')`, [family.id, inviteCode()])

  // --- расписание уроков (Пн–Пт)
  const lessons: Record<string, [number, string, string][]> = {
    Миша: [
      [1, 'Математика', '08:30'], [1, 'Русский язык', '09:25'], [1, 'Литература', '10:20'],
      [2, 'Физика', '08:30'], [2, 'История', '09:25'], [2, 'Английский язык', '10:20'], [2, 'Физкультура', '11:15'],
      [3, 'Математика', '08:30'], [3, 'Биология', '09:25'],
      [4, 'Русский язык', '08:30'], [4, 'География', '09:25'], [4, 'Информатика', '10:20'],
      [5, 'Английский язык', '08:30'], [5, 'Музыка', '09:25'], [5, 'Технология', '10:20'],
    ],
    Аня: [
      [1, 'Чтение', '09:00'], [1, 'Математика', '09:55'], [1, 'Рисование', '10:50'],
      [2, 'Окружающий мир', '09:00'], [2, 'Русский язык', '09:55'],
      [3, 'Математика', '09:00'], [3, 'Физкультура', '09:55'], [3, 'Музыка', '10:50'],
      [4, 'Чтение', '09:00'], [4, 'Английский язык', '09:55'],
      [5, 'Русский язык', '09:00'], [5, 'Математика', '09:55'],
    ],
  }
  for (const [name, rows] of Object.entries(lessons)) {
    const position = new Map<number, number>()
    for (const [weekday, subject, start] of rows) {
      const next = (position.get(weekday) ?? 0) + 1
      position.set(weekday, next)
      const [h, m] = start.split(':').map(Number)
      const end = `${pad(h + Math.floor((m + 40) / 60))}:${pad((m + 40) % 60)}` // урок 40 минут
      await pool.query(
        `insert into schedule_lessons (member_id, weekday, position, subject, starts_at, ends_at) values ($1, $2, $3, $4, $5, $6)`,
        [id(name), weekday, next, subject, start, end],
      )
    }
  }

  // --- тренировки (Пн–Вс, 7 = воскресенье)
  const trainings: [string, number, string, string | null, string | null, string | null][] = [
    ['Миша', 2, 'Плавание', 'Бассейн «Волна»', '18:00', '19:00'],
    ['Миша', 4, 'Плавание', 'Бассейн «Волна»', '18:00', '19:00'],
    ['Миша', 6, 'Футбол', 'Стадион «Юность»', '10:00', '11:30'],
    ['Аня', 3, 'Танцы', 'Дом культуры', '17:00', '18:00'],
    ['Аня', 7, 'Растяжка', null, null, null],
  ]
  for (const [name, weekday, title, place, start, end] of trainings) {
    await pool.query(
      `insert into training_sessions (member_id, weekday, position, title, place, starts_at, ends_at)
       values ($1, $2, (select coalesce(max(position), 0) + 1 from training_sessions where member_id = $1 and weekday = $2), $3, $4, $5, $6)`,
      [id(name), weekday, title, place, start, end],
    )
  }

  // --- задания: разные виды повторов, просроченное, без срока, выполненное
  interface Task { author: string; assignee: string; title: string; date: string | null; time: string | null; repeat: 'none' | 'daily' | 'weekly' | 'monthly'; days?: number[] }
  const tasks: Task[] = [
    { author: 'Лена', assignee: 'Миша', title: 'Вынести мусор', date: daysFromToday(-3), time: '20:30', repeat: 'daily' },
    { author: 'Лена', assignee: 'Аня', title: 'Покормить кота', date: daysFromToday(-3), time: '08:00', repeat: 'daily' },
    { author: 'Миша', assignee: 'Миша', title: 'Собрать портфель', date: daysFromToday(-3), time: '19:00', repeat: 'weekly', days: [1, 2, 3, 4, 7] },
    { author: 'Игорь', assignee: 'Миша', title: 'Сдать книги в библиотеку', date: daysFromToday(-2), time: null, repeat: 'none' },
    { author: 'Лена', assignee: 'Аня', title: 'Убрать игрушки', date: daysFromToday(0), time: '18:00', repeat: 'none' },
    { author: 'Лена', assignee: 'Игорь', title: 'Оплатить интернет', date: daysFromToday(3), time: null, repeat: 'monthly' },
    { author: 'Игорь', assignee: 'Лена', title: 'Купить хлеб и молоко', date: null, time: null, repeat: 'none' },
    { author: 'Лена', assignee: 'Игорь', title: 'Записать детей к врачу', date: daysFromToday(5), time: '12:00', repeat: 'none' },
  ]
  const taskIds: Record<string, string> = {}
  for (const t of tasks) {
    const { rows } = await pool.query(
      `insert into tasks (family_id, author_id, assignee_id, title, due_date, due_time, repeat_type, repeat_days)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [family.id, id(t.author), id(t.assignee), t.title, t.date, t.time, t.repeat, t.days ?? []],
    )
    taskIds[t.title] = rows[0].id
  }
  // выполнено: вчерашний «мусор» (Мишей), сегодняшняя «уборка игрушек» (Аней)
  const done = async (title: string, date: string, by: string) =>
    pool.query(`insert into task_completions (task_id, occurrence_date, done_by) values ($1, $2, $3)`, [taskIds[title], date, id(by)])
  await done('Вынести мусор', daysFromToday(-1), 'Миша')
  await done('Покормить кота', daysFromToday(0), 'Аня')
  await done('Убрать игрушки', daysFromToday(0), 'Аня')

  return { family, members }
}

const { family, members } = useExisting ? await loadExisting(snippetFor) : await createDemo()
const id = (name: string) => members[name].id
await pool.end()

// --- вывод
const identityOf = (name: string) => ({ familyCode: family.code, memberId: id(name), name, role: members[name].role, token: members[name].token })

// Код для консоли браузера (или инструмента javascript_exec): записывает вход в IndexedDB так же, как это делает приложение.
const snippetOf = (name: string) =>
  `(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('keyval-store');q.onupgradeneeded=()=>q.result.createObjectStore('keyval');q.onsuccess=()=>r(q.result)});` +
  `await new Promise(r=>{const t=db.transaction('keyval','readwrite');t.objectStore('keyval').put(${JSON.stringify(identityOf(name))},'identity');t.oncomplete=r});db.close();location.href='/my-day'})()`

if (snippetFor) {
  if (!members[snippetFor]) {
    console.error(`Нет участника «${snippetFor}». Есть: ${Object.keys(members).join(', ')}.`)
    process.exit(1)
  }
  console.log(snippetOf(snippetFor))
} else if (asJson) {
  console.log(JSON.stringify({ familyCode: family.code, members: Object.fromEntries(Object.keys(members).map((n) => [n, { ...identityOf(n), email: members[n].email }])) }, null, 2))
} else {
  console.log(`Демо-семья ${useExisting ? "найдена" : "создана"} (код ${family.code}).\n`)
  for (const p of people) console.log(`  ${p.name.padEnd(6)} ${p.role.padEnd(6)} ${p.email}`)
  console.log(`
Как войти:
  • по почте: на странице входа введите email из списка, код придёт в Mailpit (http://localhost:8025);
  • без почты: npm run seed -- --snippet Миша  выдаст код для консоли браузера, он сразу выполнит вход;
  • для скриптов и тестов API: npm run seed -- --json  (там id и токены сессий для заголовка Authorization: Bearer).

Что есть в демо: расписание уроков (Пн–Пт) и тренировки у Миши и Ани; у Миши сегодня день рождения;
задания: ежедневные, недельное, ежемесячное, просроченное, без срока, часть выполнена.`)
}
