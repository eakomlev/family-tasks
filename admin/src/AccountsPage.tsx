import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError, get, type AccountPage, type AccountSummary } from './api'

const fmtDate = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const roleLabel = (role: string) => ({ mama: 'Мама', papa: 'Папа', grandma: 'Бабушка', grandpa: 'Дедушка', child: 'Ребёнок' }[role] ?? role)

export default function AccountsPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<AccountPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice ?? '')

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const query = new URLSearchParams({ page: String(page), pageSize: '25' })
        if (search.trim()) query.set('search', search.trim())
        const data = await get<AccountPage>(`/admin/accounts?${query.toString()}`, token)
        if (active) setResult(data)
      } catch (err) {
        if (active) setError(err instanceof ApiError && err.status === 401 ? 'Сессия истекла. Войдите снова.' : 'Не удалось загрузить аккаунты.')
      } finally { if (active) setLoading(false) }
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [page, search, token])

  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)))
  return <div className="accounts-page">
    <div className="page-heading"><div><div className="eyebrow">АДМИНИСТРИРОВАНИЕ</div><h1>Аккаунты</h1><p>Поиск и управление участниками приложения</p></div><div className="total-pill">{result ? `${result.total.toLocaleString('ru-RU')} аккаунтов` : 'Загрузка…'}</div></div>
    {notice && <div className="result-notice"><span>{notice}</span><button onClick={() => { setNotice(''); navigate(location.pathname, { replace: true, state: null }) }} aria-label="Закрыть">×</button></div>}
    <section className="panel accounts-panel">
      <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Имя, email, телефон или семья" aria-label="Поиск аккаунтов" /></label>
      {error && <div className="alert bad">{error}</div>}
      <div className="table-scroll"><table className="account-table">
        <thead><tr><th>Участник</th><th>Контакт</th><th>Семья</th><th>Создан</th><th>Статус</th><th /></tr></thead>
        <tbody>
          {loading && !result && <tr><td colSpan={6} className="table-empty">Загружаем аккаунты…</td></tr>}
          {result?.items.map(account => <AccountRow key={account.id} account={account} onOpen={() => navigate(`/accounts/${account.id}`)} />)}
          {result && !result.items.length && <tr><td colSpan={6} className="table-empty">{search ? 'Ничего не найдено. Попробуйте изменить запрос.' : 'Аккаунтов пока нет.'}</td></tr>}
        </tbody>
      </table></div>
      <div className="pagination"><span>{result ? `${result.total ? (page - 1) * result.pageSize + 1 : 0}–${Math.min(page * result.pageSize, result.total)} из ${result.total.toLocaleString('ru-RU')}` : ' '}</span><div><button disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>← Назад</button><span>Страница {page} из {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Дальше →</button></div></div>
    </section>
  </div>
}

function AccountRow({ account, onOpen }: { account: AccountSummary; onOpen: () => void }) {
  const contact = account.email ?? account.phone ?? '—'
  const family = account.family ? `${account.family.surname ? `${account.family.surname} · ` : ''}${account.family.code}` : 'Без семьи'
  return <tr className="account-row" tabIndex={0} role="link" onClick={onOpen} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
    <td><div className="account-name"><span className={`role-mark ${account.role === 'child' ? 'child' : ''}`}>{account.name.trim()[0]?.toLocaleUpperCase('ru-RU') ?? '?'}</span><span><b>{account.name}</b><small>{roleLabel(account.role)}{account.isOwner ? ' · создатель' : ''}</small></span></div></td>
    <td className="account-contact">{contact}{account.email && account.phone && <small>{account.phone}</small>}</td>
    <td><span className="family-cell">{family}</span>{account.familyDeletionRequestedAt && <small className="row-note">Удаляется</small>}</td>
    <td className="date-cell">{fmtDate(account.createdAt)}</td>
    <td><span className={`status-chip ${account.accessBlocked || account.familyDeletionRequestedAt ? 'blocked' : 'active'}`}><i />{account.familyDeletionRequestedAt ? 'Удаляется' : account.accessBlocked ? 'Заблокирован' : 'Активен'}</span></td>
    <td className="row-arrow">↗</td>
  </tr>
}
