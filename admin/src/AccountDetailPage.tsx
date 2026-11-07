import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, del, get, patch, type AccountDetail } from './api'

type Action = 'block' | 'unblock' | 'delete' | null
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' }) : '—'
const shortDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { dateStyle: 'long' }) : '—'
const roleLabel = (role: string) => ({ mama: 'Мама', papa: 'Папа', grandma: 'Бабушка', grandpa: 'Дедушка', child: 'Ребёнок' }[role] ?? role)
const fmt = (value: number) => value.toLocaleString('ru-RU')

export default function AccountDetailPage({ id, token, current }: {
  id: string; token: string; current: { id: string; email: string | null; phone: string | null }
}) {
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function refresh() {
    setLoading(true); setError('')
    try { setAccount(await get<AccountDetail>(`/admin/accounts/${encodeURIComponent(id)}`, token)) }
    catch (err) { setError(err instanceof ApiError && err.status === 404 ? 'Аккаунт не найден.' : 'Не удалось загрузить сведения об аккаунте.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [id, token])

  const ownContact = !!account && ((account.email && current.email && account.email.toLowerCase() === current.email.toLowerCase()) || (account.phone && current.phone && account.phone === current.phone))
  const canManageBlock = !!account && !ownContact && !account.familyDeletionRequestedAt
  const blockedThroughRelated = !!account?.accessBlocked && !account?.blockedAt

  async function performAction() {
    if (!account || !action) return
    setBusy(true); setError('')
    try {
      if (action === 'block' || action === 'unblock') {
        await patch(`/admin/accounts/${account.id}`, { blocked: action === 'block' }, token)
        setNotice(action === 'block' ? 'Аккаунт и вход по совпадающим контактам заблокированы.' : 'Блокировка этого аккаунта снята. Для входа потребуется запросить новый код.')
        setAction(null); await refresh()
      } else {
        const result = await del<{ deletionRequestedAt?: string; familyDeletion?: boolean }>(`/admin/accounts/${account.id}`, token)
        const text = result?.familyDeletion
          ? 'Удаление семейного аккаунта поставлено в очередь. Семья и её данные будут удалены планировщиком.'
          : `Аккаунт «${account.name}» удалён.`
        navigate('/accounts', { replace: true, state: { notice: text } })
      }
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'cannot_block_self' ? 'Нельзя заблокировать доступ по собственному email или телефону.'
        : err instanceof ApiError && err.code === 'cannot_delete_self' ? 'Нельзя удалить текущий аккаунт администратора.'
        : 'Не удалось выполнить действие. Обновите страницу и попробуйте ещё раз.')
      setAction(null)
    } finally { setBusy(false) }
  }

  return <div className="account-detail-page">
    <button className="back-button" onClick={() => navigate('/accounts')}>← <span>Все аккаунты</span></button>
    {loading && !account ? <div className="loading">Загружаем карточку аккаунта…</div> : error && !account ? <div className="panel"><div className="alert bad">{error}</div><button className="secondary" onClick={() => navigate('/accounts')}>Вернуться к списку</button></div> : account && <>
      <div className="detail-heading">
        <div className="detail-person"><div className="detail-avatar">{account.avatar ? <img src={account.avatar} alt="" /> : account.name.trim()[0]?.toLocaleUpperCase('ru-RU') ?? '?'}</div><div><div className="eyebrow">АККАУНТ УЧАСТНИКА</div><h1>{account.name}</h1><div className="detail-subtitle">{roleLabel(account.role)}{account.isOwner ? ' · создатель семьи' : ''}<span>·</span>Добавлен {shortDate(account.createdAt.slice(0, 10))}</div></div></div>
        <div className={`status-chip large ${account.familyDeletionRequestedAt ? 'blocked' : account.accessBlocked ? 'blocked' : 'active'}`}><i />{account.familyDeletionRequestedAt ? 'Семья удаляется' : account.accessBlocked ? 'Доступ заблокирован' : 'Активен'}</div>
      </div>
      {notice && <div className="result-notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Закрыть">×</button></div>}
      {error && <div className="alert bad">{error}</div>}
      {account.familyDeletionRequestedAt && <div className="alert bad">Удаление семьи запрошено {dateTime(account.familyDeletionRequestedAt)}. Вход и доступ всем участникам семьи закрыты.</div>}
      <div className="detail-grid">
        <section className="panel detail-panel"><h2>Профиль</h2><div className="detail-fields">
          <Field label="Имя" value={account.name} /><Field label="Email" value={account.email ?? 'Не указан'} /><Field label="Телефон" value={account.phone ?? 'Не указан'} />
          <Field label="Роль" value={roleLabel(account.role)} /><Field label="Дата рождения" value={shortDate(account.birthDate)} /><Field label="Создан" value={dateTime(account.createdAt)} />
          <Field label="Настроение" value={account.mood ? `${account.mood.value} из 5 · ${dateTime(account.mood.at)}` : 'Не выбрано'} />
          <Field label="Заблокирован" value={dateTime(account.blockedAt)} />
          <Field label="Согласие на обработку данных" value={account.consentVersion ? `${account.consentVersion} · ${dateTime(account.consentAt)}` : 'Не подтверждено'} wide />
          <Field label="ID аккаунта" value={account.id} mono wide />
        </div></section>
        <section className="panel detail-panel"><h2>Семья</h2>{account.familyId ? <>
          <div className="family-summary"><div><span>Название</span><b>{account.familySurname || 'Без фамилии'}</b></div><div><span>Код семьи</span><b>{account.familyCode}</b></div><div><span>Участников</span><b>{account.familyMembers.length}</b></div></div>
          <div className="member-list">{account.familyMembers.map(member => <button key={member.id} className="member-link" onClick={() => navigate(`/accounts/${member.id}`)}><span className="member-letter">{member.name.trim()[0]?.toLocaleUpperCase('ru-RU') ?? '?'}</span><span><b>{member.name}</b><small>{roleLabel(member.role)}{member.isOwner ? ' · создатель' : ''}</small></span><span className={`mini-status ${member.accessBlocked ? 'blocked' : ''}`}>{member.accessBlocked ? 'Блок' : ''}</span><span className="row-arrow">↗</span></button>)}</div>
        </> : <div className="empty-inline">Участник сейчас не состоит в семье.</div>}</section>
        <section className="panel detail-panel"><h2>Активность и устройства</h2><div className="metrics detail-metrics">
          <Metric label="Последняя активность" value={dateTime(account.lastSeenAt)} /><Metric label="Сессии устройств" value={fmt(account.sessionCount)} /><Metric label="Push-подписки" value={fmt(account.pushCount)} />
          <Metric label="Заданий создано" value={fmt(account.tasksCreated)} /><Metric label="Заданий назначено" value={fmt(account.tasksAssigned)} /><Metric label="Выполнений" value={fmt(account.tasksCompleted)} />
          <Metric label="Сообщений отправлено" value={fmt(account.messagesSent)} /><Metric label="Событий создано" value={fmt(account.eventsCreated)} /><Metric label="Целей" value={fmt(account.goals)} />
          <Metric label="Игр" value={fmt(account.games)} /><Metric label="Операций с монетами" value={fmt(account.coinTransactions)} />
        </div></section>
        {account.relatedAccounts.length > 0 && <section className="panel detail-panel"><h2>Другие профили с тем же контактом</h2><p className="panel-hint">Блокировка по email или телефону закрывает вход и в эти профили.</p><div className="member-list">{account.relatedAccounts.map(related => <button key={related.id} className="member-link" onClick={() => navigate(`/accounts/${related.id}`)}><span className="member-letter">{related.name.trim()[0]?.toLocaleUpperCase('ru-RU') ?? '?'}</span><span><b>{related.name}</b><small>{roleLabel(related.role)}{related.familySurname ? ` · ${related.familySurname}` : ''}{related.familyCode ? ` · ${related.familyCode}` : ''}</small></span><span className={`mini-status ${related.accessBlocked ? 'blocked' : ''}`}>{related.accessBlocked ? 'Блок' : ''}</span><span className="row-arrow">↗</span></button>)}</div></section>}
        <section className="panel detail-panel actions-panel"><h2>Действия</h2><p>Блокировка действует на этот аккаунт и вход по его email или телефону в других семьях. Активные сессии будут отозваны.</p>
          {ownContact && <div className="alert quiet">Этот профиль использует ваш контакт администратора, поэтому блокировка отключена.</div>}
          {blockedThroughRelated && <div className="alert quiet">Вход заблокирован из-за другого профиля с таким же контактом. Снимите блокировку в карточке этого профиля.</div>}
          {canManageBlock && <button className={account.blockedAt ? 'secondary' : 'warning-button'} onClick={() => setAction(account.blockedAt ? 'unblock' : 'block')}>{account.blockedAt ? 'Снять блокировку' : 'Заблокировать аккаунт'}</button>}
          <div className="delete-action"><div><b>Удалить аккаунт</b><span>{account.isOwner ? 'Удаление создателя удалит всю семью и её данные.' : 'Удаление необратимо удалит профиль и связанные с ним данные.'}</span></div><button className="danger-button" disabled={account.id === current.id || !!account.familyDeletionRequestedAt} onClick={() => setAction('delete')}>{account.familyDeletionRequestedAt ? 'Удаление поставлено' : 'Удалить'}</button></div>
          {account.id === current.id && <div className="panel-hint">Нельзя удалить текущий аккаунт, под которым выполнен вход.</div>}
        </section>
      </div>
      {action && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setAction(null) }}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className={`modal-mark ${action === 'delete' || action === 'block' ? 'danger' : ''}`}>{action === 'delete' ? '!' : action === 'block' ? '⊘' : '✓'}</div>
        <h2 id="confirm-title">{action === 'delete' ? 'Удалить аккаунт?' : action === 'block' ? 'Заблокировать доступ?' : 'Снять блокировку?'}</h2>
        <p>{action === 'delete'
          ? account.isOwner ? `«${account.name}» — создатель семьи. Вместе с аккаунтом будет поставлена в очередь на удаление вся семья: участники, чаты, задания и другие данные.` : `Профиль «${account.name}» и связанные с ним данные будут удалены без возможности восстановления.`
          : action === 'block' ? `Вход по ${account.email ?? account.phone ?? 'контакту'} будет закрыт во всех профилях с совпадающим email или телефоном. Текущие сессии будут отозваны.`
          : `Вход по контактам этого аккаунта снова станет доступен. Все устройства должны будут войти заново.`}</p>
        <div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setAction(null)}>Отмена</button><button className={action === 'delete' || action === 'block' ? 'danger-button' : 'primary'} disabled={busy} onClick={() => void performAction()}>{busy ? 'Подождите…' : action === 'delete' ? 'Удалить' : action === 'block' ? 'Заблокировать' : 'Разблокировать'}</button></div>
      </section></div>}
    </>}
  </div>
}

function Field({ label, value, wide = false, mono = false }: { label: string; value: string; wide?: boolean; mono?: boolean }) {
  return <div className={`detail-field${wide ? ' wide' : ''}`}><span>{label}</span><b className={mono ? 'monospace' : ''}>{value}</b></div>
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}
