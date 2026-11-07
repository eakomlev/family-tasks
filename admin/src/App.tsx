import { useEffect, useState } from 'react'
import { ApiError, get, post, revokeSession, type AdminStats, type LoginOption, type Session, type ServiceStats } from './api'
import { getCaptchaToken, isCaptchaEnabled } from './captcha'

const number = (value: number) => value.toLocaleString('ru-RU')
const rub = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
const age = (seconds: number | null) => {
  if (seconds === null) return '—'
  const mins = Math.floor(Math.max(0, seconds) / 60)
  return mins < 1 ? `${Math.max(0, Math.floor(seconds))} с` : mins < 60 ? `${mins} мин` : `${Math.floor(mins / 60)} ч ${mins % 60 ? `${mins % 60} мин` : ''}`.trim()
}
const bytes = (size: number) => {
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let n = Math.max(0, size), i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`
}
const nextUtcMidnight = (date: Date) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
  return next.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>
}
function Metric({ label, value, quiet = false }: { label: string; value: React.ReactNode; quiet?: boolean }) {
  return <div className={`metric${quiet ? ' quiet' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}
function Alert({ children, tone = 'warn' }: { children: React.ReactNode; tone?: 'warn' | 'bad' | 'quiet' }) {
  return <div className={`alert ${tone}`}>{children}</div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem('admin-session') || 'null') as Session | null } catch { return null }
  })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [options, setOptions] = useState<LoginOption[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [me, setMe] = useState<{ name: string; isAdmin: boolean } | null>(null)
  const [stats, setStats] = useState<ServiceStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failure, setFailure] = useState('')
  const [tick, setTick] = useState(Date.now())
  const [captchaEnabled, setCaptchaEnabled] = useState(false)

  useEffect(() => { void isCaptchaEnabled().then(setCaptchaEnabled).catch(() => undefined) }, [])

  async function signOut() {
    if (session) await revokeSession(session.member.token).catch(() => undefined)
    localStorage.removeItem('admin-session'); setSession(null); setMe(null); setStats(null)
  }

  useEffect(() => { const id = window.setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!session) return
    let alive = true
    const refresh = async () => {
      try {
        const profile = await get<{ member: { name: string; isAdmin?: boolean } }>('/me', session.member.token)
        if (!alive) return
        setMe({ name: profile.member.name, isAdmin: !!profile.member.isAdmin })
        if (!profile.member.isAdmin) { setFailure('У этой учётной записи нет доступа к администрированию.'); return }
        const since = new Date(); since.setHours(0, 0, 0, 0)
        const [data] = await Promise.all([get<ServiceStats>(`/admin/stats?since=${encodeURIComponent(since.toISOString())}`, session.member.token)])
        if (alive) { setStats(data); setFailure('') }
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) { localStorage.removeItem('admin-session'); setSession(null); return }
        setFailure('Не удалось обновить часть данных. Проверьте соединение и попробуйте ещё раз.')
      } finally { if (alive) setLoaded(true) }
    }
    void refresh()
    const id = window.setInterval(refresh, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [session])

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const captchaToken = await getCaptchaToken()
      await post('/email-codes', { email: email.trim().toLowerCase(), purpose: 'login', ...(captchaToken ? { captchaToken } : {}) })
      setStep('code')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_soon') setError('Код уже отправлен. Проверьте почту.')
      else if (e instanceof ApiError && e.code === 'captcha_cancelled') setError('Проверка не пройдена. Попробуйте ещё раз.')
      else if (e instanceof ApiError && (e.code === 'captcha_unavailable' || e.code === 'captcha_failed' || e.code === 'captcha_required')) setError('Не удалось пройти проверку. Проверьте соединение и попробуйте ещё раз.')
      else setError('Не удалось отправить код. Проверьте адрес и попробуйте снова.')
    }
    finally { setBusy(false) }
  }
  async function signIn(enteredCode: string, memberId?: string) {
    setBusy(true); setError('')
    try {
      const result = await post<Session>('/auth/login', { email: email.trim().toLowerCase(), code: enteredCode, ...(memberId ? { memberId } : {}) })
      localStorage.setItem('admin-session', JSON.stringify(result)); setSession(result); setOptions([])
    } catch (e) {
      if (e instanceof ApiError && e.code === 'choose_member') {
        const data = e.body as { options?: LoginOption[] }
        if (data.options?.length) { setOptions(data.options); return }
      }
      setError(e instanceof ApiError && e.code === 'invalid_code' ? 'Неверный код или срок его действия истёк.' : 'Не удалось войти. Проверьте код и попробуйте ещё раз.')
    } finally { setBusy(false) }
  }

  const admin = session && me?.isAdmin
  return <main className="shell">
    <header className="top"><a className="brand" href="/" aria-label="Моя Семья"><span className="brand-icon">⌂</span><span>Моя Семья <i>console</i></span></a>{admin && <div className="account"><span>{me.name}</span><button onClick={() => void signOut()}>Выйти</button></div>}</header>
    {!session ? <section className="login panel"><div className="eyebrow">КОНСОЛЬ АДМИНИСТРАТОРА</div><h1>{step === 'email' ? 'Вход в админку' : 'Введите код'}</h1><p>{step === 'email' ? 'Войдите по email, указанному в списке ADMIN_EMAILS.' : `Мы отправили одноразовый код на ${email}.`}</p>
      {options.length ? <div className="option-list"><p>Выберите участника:</p>{options.map(option => <button className="option" key={option.id} disabled={busy} onClick={() => signIn(code, option.id)}><span>{option.name}</span><small>{option.role === 'adult' ? 'Взрослый' : 'Ребёнок'} · семья {option.familyCode}</small></button>)}</div> : <form onSubmit={step === 'email' ? requestCode : e => { e.preventDefault(); void signIn(code) }}>
        {step === 'email' ? <label>Email<input autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></label> : <label>Код из письма<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /></label>}
        {error && <Alert tone="bad">{error}</Alert>}<button className="primary" disabled={busy}>{busy ? 'Подождите…' : step === 'email' ? 'Получить код' : 'Войти'}</button>
        {step === 'email' && captchaEnabled && <div className="captcha-notice">Защищено Yandex SmartCaptcha. <a href="https://yandex.ru/legal/confidential/" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a> и <a href="https://yandex.ru/legal/smartcaptcha_agreement/" target="_blank" rel="noopener noreferrer">Условия использования</a>.</div>}
        {step === 'code' && <button className="text-button" type="button" onClick={() => { setStep('email'); setError('') }}>Изменить email</button>}
      </form>}
      <div className="login-foot">Доступ разрешён только администраторам сервиса</div>
    </section> : !admin ? <section className="login panel"><h1>Проверка доступа</h1>{failure ? <Alert tone="bad">{failure}</Alert> : <p>Проверяем учётную запись…</p>}<button className="text-button" onClick={() => void signOut()}>Выйти</button></section> : <>
      <div className="hero"><div><div className="eyebrow">СОСТОЯНИЕ ПЛАТФОРМЫ</div><h1>Сводка сервиса</h1><p>Основные показатели и здоровье фоновых сервисов</p></div><div className="updated"><span className="live-dot"/>Обновление каждые 30 секунд <b>{new Date(tick).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b></div></div>
      {failure && <Alert tone="bad">{failure}</Alert>}
      {!stats && !loaded && <div className="loading">Загружаем показатели…</div>}
      {stats && <div className="stats-grid"><Panel title="Аккаунты"><div className="metrics"><Metric label="Всего аккаунтов" value={number(stats.accounts.total)} /><Metric label="Новых сегодня" value={number(stats.accounts.today)} /><Metric label="Семей всего" value={number(stats.families.total)} /><Metric label="Новых семей сегодня" value={number(stats.families.today)} /></div></Panel><Panel title="Сообщения"><div className="metrics"><Metric label="Отправлено всего" value={number(stats.messages.total)} /><Metric label="Сегодня" value={number(stats.messages.today)} /></div></Panel></div>}
      <Dashboard token={session.member.token} now={new Date(tick)} />
    </>}
    <footer>МОЯ СЕМЬЯ <span>·</span> КОНСОЛЬ УПРАВЛЕНИЯ</footer>
  </main>
}

function Dashboard({ token, now }: { token: string; now: Date }) {
  const [data, setData] = useState<AdminStats>({})
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [queue, media, sms] = await Promise.all([get<AdminStats['queue']>('/admin/queue', token), get<AdminStats['media']>('/admin/media', token), get<AdminStats['sms']>('/admin/sms', token)])
        if (alive) { setData({ queue, media, sms }); setError('') }
      } catch { if (alive) setError('Не удалось загрузить состояние очередей и сервисов.') }
    }
    void load(); const id = window.setInterval(load, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [token])
  const q = data.queue, sms = data.sms, media = data.media
  const warnings: { text: string; tone: 'warn' | 'bad' | 'quiet' }[] = []
  if (q) {
    if (!q.notifier.alive) warnings.push({ tone: 'bad', text: `Сервис отправки не отвечает. Писем и push в очереди: ${number(q.waiting.email + q.waiting.push)}.${q.notifier.lastBeatSeconds === null ? '' : ` Последний сигнал ${age(q.notifier.lastBeatSeconds)} назад.`}` })
    if (q.oldestSeconds !== null && q.oldestSeconds > 300) warnings.push({ tone: 'warn', text: `Самое старое сообщение ждёт ${age(q.oldestSeconds)}.` })
    if (q.mail.limit && q.mail.usedToday >= q.mail.limit) warnings.push({ tone: 'bad', text: `Дневной лимит писем исчерпан: коды входа не отправляются до ${nextUtcMidnight(now)} (полночь по UTC).` })
    else if (q.mail.limit && q.mail.usedToday >= q.mail.limit * 0.8) warnings.push({ tone: 'warn', text: `Израсходовано ${Math.floor(q.mail.usedToday / q.mail.limit * 100)}% дневного лимита писем.` })
    if (q.scheduler && !q.scheduler.alive) warnings.push({ tone: 'bad', text: `Планировщик не отвечает: напоминания не отправляются.${q.scheduler.lastBeatSeconds === null ? '' : ` Последний сигнал ${age(q.scheduler.lastBeatSeconds)} назад.`}` })
    else if (q.scheduler?.lastTickSeconds !== null && q.scheduler?.lastTickSeconds !== undefined && q.scheduler.lastTickSeconds > 300) warnings.push({ tone: 'warn', text: `Планировщик не делал проход ${age(q.scheduler.lastTickSeconds)}.` })
    if (q.scheduler?.lastError) warnings.push({ tone: 'warn', text: `Ошибка планировщика: ${q.scheduler.lastError}` })
    if (q.realtime && !q.realtime.alive) warnings.push({ tone: 'bad', text: `Сервис живых обновлений не отвечает.${q.realtime.lastBeatSeconds === null ? '' : ` Последний сигнал ${age(q.realtime.lastBeatSeconds)} назад.`}` })
    const fails = q.today.email.failed + q.today.push.failed
    if (fails) warnings.push({ tone: 'warn', text: `Сегодня не удалось отправить: письма ${q.today.email.failed}, push ${q.today.push.failed}.` })
  }
  if (sms?.configured) {
    if (sms.balance.error) warnings.push({ tone: 'warn', text: `Не удалось проверить баланс SMS Aero: ${sms.balance.error}` })
    else if (sms.balance.checkedSeconds !== null && sms.balance.checkedSeconds > 900) warnings.push({ tone: 'warn', text: `Баланс SMS не обновлялся ${age(sms.balance.checkedSeconds)}.` })
    if (sms.balance.amount !== null && sms.balance.amount < 30) warnings.push({ tone: 'bad', text: `На счёте SMS Aero осталось ${rub(sms.balance.amount)}.` })
    else if (sms.balance.amount !== null && sms.balance.amount < 100) warnings.push({ tone: 'warn', text: `На счёте SMS Aero осталось ${rub(sms.balance.amount)}.` })
    if (sms.limit && sms.usedToday >= sms.limit) warnings.push({ tone: 'bad', text: `Дневной лимит SMS исчерпан: коды по телефону не отправляются до ${nextUtcMidnight(now)} (полночь по UTC).` })
    else if (sms.limit && sms.usedToday >= sms.limit * 0.8) warnings.push({ tone: 'warn', text: `Израсходовано ${Math.floor(sms.usedToday / sms.limit * 100)}% дневного лимита SMS.` })
    if (sms.today.failed) warnings.push({ tone: 'warn', text: `Сегодня не удалось отправить SMS: ${sms.today.failed}.` })
  }
  if (media?.configured && !media.alive) warnings.push({ tone: 'bad', text: 'Сервис фото или хранилище не отвечает.' })
  if (media?.configured && media.quotaBytes > 0 && media.busiestFamilyBytes >= media.quotaBytes * 0.8) warnings.push({ tone: media.busiestFamilyBytes >= media.quotaBytes ? 'bad' : 'warn', text: `Одна из семей использовала ${Math.floor(media.busiestFamilyBytes / media.quotaBytes * 100)}% квоты фото.` })
  return <>
    {error && <Alert tone="bad">{error}</Alert>}
    {warnings.map((w, i) => <Alert key={i} tone={w.tone}>{w.text}</Alert>)}
    {q && <Panel title="Очередь отправки"><div className="metrics"><Metric label="Писем ждут" value={number(q.waiting.email)} /><Metric label="Push ждут" value={number(q.waiting.push)} /><Metric label="Ждут повтора" value={number(q.retrying)} /><Metric label="Самое старое" value={age(q.oldestSeconds)} /><Metric label="Сервис отправки" value={q.notifier.alive ? 'Работает' : 'Не отвечает'} quiet /><Metric label="Письма за сутки · UTC" value={q.mail.limit ? `${number(q.mail.usedToday)} из ${number(q.mail.limit)}` : number(q.mail.usedToday)} quiet /><Metric label="Отправлено сегодня" value={`письма ${number(q.today.email.sent)} · push ${number(q.today.push.sent)}`} quiet /><Metric label="Не удалось сегодня" value={`письма ${number(q.today.email.failed)} · push ${number(q.today.push.failed)}`} quiet /></div></Panel>}
    {sms && <Panel title="SMS · вход по телефону">{!sms.configured ? <Alert tone="quiet">SMS не настроены: у notifier нет ключей SMS Aero.</Alert> : <><div className="metrics"><Metric label="Остаток на счёте" value={sms.balance.amount === null ? '—' : rub(sms.balance.amount)} /><Metric label="Хватит примерно на" value={sms.balance.amount === null || sms.week.sent <= 0 || sms.week.spend <= 0 ? '—' : `${number(Math.floor(sms.balance.amount / (sms.week.spend / sms.week.sent)))} SMS`} /><Metric label="Отправлено сегодня" value={number(sms.today.sent)} /><Metric label="Потрачено сегодня" value={rub(sms.today.spend)} /><Metric label="За 7 суток" value={`${number(sms.week.sent)} SMS · ${rub(sms.week.spend)}`} quiet /><Metric label="Не удалось сегодня" value={number(sms.today.failed)} quiet /><Metric label="Ждут отправки" value={`${number(sms.waiting)}${sms.retrying ? ` · повтор ${number(sms.retrying)}` : ''}`} quiet /><Metric label="Лимит за сутки · UTC" value={sms.limit ? `${number(sms.usedToday)} из ${number(sms.limit)}` : number(sms.usedToday)} quiet /><Metric label="Остаток проверен" value={age(sms.balance.checkedSeconds)} quiet /></div>{sms.days.length > 0 && <div className="day-list">{sms.days.map(day => <div className="day" key={day.day}><span>{new Date(`${day.day}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span><b>{number(day.sent)} SMS · {rub(day.spend)}{day.failed ? ` · ошибок ${number(day.failed)}` : ''}</b></div>)}</div>}</>}</Panel>}
    {q?.scheduler && <Panel title="Планировщик"><div className="metrics"><Metric label="Состояние" value={q.scheduler.alive ? 'Работает' : 'Не отвечает'} quiet /><Metric label="Последний проход" value={age(q.scheduler.lastTickSeconds)} quiet /><Metric label="Поставил в очередь" value={q.scheduler.lastSent === null ? '—' : number(q.scheduler.lastSent)} quiet /></div></Panel>}
    {q?.realtime && <Panel title="Живые обновления"><div className="metrics"><Metric label="Состояние" value={q.realtime.alive ? 'Работает' : 'Не отвечает'} quiet /><Metric label="Соединений сейчас" value={number(q.realtime.connections)} quiet /></div></Panel>}
    {media && <Panel title="Фото в чатах">{!media.configured ? <Alert tone="quiet">Отправка фото выключена: на сервере не настроено хранилище.</Alert> : <div className="metrics"><Metric label="Сервис фото" value={media.alive ? 'Работает' : 'Не отвечает'} quiet /><Metric label="Фото всего" value={number(media.photos)} /><Metric label="Занято места" value={bytes(media.bytes)} /><Metric label="Не прикреплено" value={`${number(media.unattached.photos)} · ${bytes(media.unattached.bytes)}`} quiet /><Metric label="Больше всего у семьи" value={`${bytes(media.busiestFamilyBytes)} из ${bytes(media.quotaBytes)}`} quiet /></div>}</Panel>}
    {!q && !sms && !media && !error && <div className="loading">Загружаем состояние сервисов…</div>}
  </>
}
