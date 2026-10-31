import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { MAX_FAMILY_MEMBERS, ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { MemberRow } from './components/MemberRow'
import { EditLink, Head, Members } from './styles'
import { useGetFamilyConnectionsQuery, useSendFamilyConnectionRequestMutation, useRespondFamilyConnectionRequestMutation, useDisconnectFamilyMutation } from '@/store/familyConnections'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { useInFlight } from '@/lib/useInFlight'

export default function Family() {
  const { identity } = useIdentity()
  const { data, failed } = useProfile()
  const [tab, setTab] = useState<'family' | 'connections'>('family')
  const [familyCode, setFamilyCode] = useState('')
  const [surname, setSurname] = useState('')
  const connectionQuery = useGetFamilyConnectionsQuery(undefined, { skip: !identity || tab !== 'connections' })
  const [sendRequest, sendState] = useSendFamilyConnectionRequestMutation()
  const [respond, respondState] = useRespondFamilyConnectionRequestMutation()
  const [disconnect, disconnectState] = useDisconnectFamilyMutation()
  const confirm = useConfirm()
  const guard = useInFlight()

  if (!identity) return <Navigate to="/" replace />

  return (
    <Page>
      <Head>
        <h1>Ваша семья</h1>
        {/* менять состав семьи и удалять её может только создатель */}
        {data?.me.isOwner && <EditLink to="/family/edit">Изменить</EditLink>}
      </Head>
      <nav aria-label="Раздел семьи" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" aria-pressed={tab === 'family'} onClick={() => setTab('family')}>Моя семья</button>
        <button type="button" aria-pressed={tab === 'connections'} onClick={() => setTab('connections')}>Связи</button>
      </nav>
      {tab === 'connections' ? <>
        {!identity ? null : identity.role === 'child' ? <Notice $tone="muted">Связями между семьями могут управлять только взрослые.</Notice> : <>
          <h2>Связанные семьи</h2>
          {connectionQuery.data?.connections.map((family) => <section key={family.familyId}>
            <h3>{family.surname ? `Семья ${family.surname}` : `Семья ${family.code}`}</h3>
            <ul>{family.members.map((member) => <li key={member.id}><Link to={`/family/${member.id}`}>{member.name} · {ROLE_LABELS[member.role]}</Link></li>)}</ul>
            {data?.me.isOwner && <button type="button" onClick={guard(async () => {
              if (await confirm({ title: 'Разорвать связь?', message: 'Участники этой семьи потеряют доступ к общим событиям и играм.', confirmLabel: 'Разорвать', danger: true })) await disconnect(family.familyId).unwrap().catch(() => {})
            })}>Разорвать связь</button>}
          </section>)}
          <h2>Запросы</h2>
          {connectionQuery.data?.requests.map((request) => <section key={request.id}>
            <p>{request.outgoing ? `Запрос отправлен семье ${request.surname ?? request.familyCode}` : `Запрос от семьи ${request.fromSurname}`}</p>
            {!request.outgoing && <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={respondState.isLoading || !(surname.trim() || connectionQuery.data?.surname)} onClick={guard(async () => { await respond({ id: request.id, action: 'accept', surname: surname.trim() || connectionQuery.data?.surname || '' }).unwrap().catch(() => {}) })}>Принять</button>
              <button type="button" disabled={respondState.isLoading} onClick={guard(async () => { await respond({ id: request.id, action: 'reject' }).unwrap().catch(() => {}) })}>Отклонить</button>
            </div>}
          </section>)}
          {(respondState.isError || disconnectState.isError) && <Notice $tone="error">Не удалось выполнить действие. Обновите страницу и попробуйте ещё раз.</Notice>}
          <h2>Отправить запрос</h2>
          <label>Код семьи<input value={familyCode} onChange={(event) => setFamilyCode(event.target.value)} maxLength={32} /></label>
          <label>Фамилия вашей семьи<input value={surname} onChange={(event) => setSurname(event.target.value)} placeholder={connectionQuery.data?.surname ?? ''} maxLength={80} /></label>
          <button type="button" disabled={sendState.isLoading || !familyCode.trim() || !(surname.trim() || connectionQuery.data?.surname)} onClick={guard(async () => { await sendRequest({ familyCode: familyCode.trim(), surname: surname.trim() || connectionQuery.data?.surname || '' }).unwrap().catch(() => {}) })}>Отправить запрос</button>
          {sendState.isError && <Notice $tone="error">Не удалось отправить запрос. Проверьте код и попробуйте ещё раз.</Notice>}
        </>}
      </> : <>
      {identity.role !== 'child' && <p>Вы вошли как <strong>{identity.name}</strong> ({ROLE_LABELS[identity.role]}). Код семьи: <code>{identity.familyCode}</code></p>}

      <h2>Участники{data && ` (${data.members.length} из ${MAX_FAMILY_MEMBERS})`}</h2>
      {failed && !data && <Notice $tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
      {!data && !failed && <p>Загрузка…</p>}
      <Members>
        {data?.members.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === identity.memberId} />
        ))}
      </Members>

      {data?.me.isOwner && data.members.length < MAX_FAMILY_MEMBERS && <MenuLink to="/family/invite">Пригласить</MenuLink>}
      {data?.me.isOwner && data.members.length >= MAX_FAMILY_MEMBERS && <Notice $tone="muted">В семье максимум участников ({MAX_FAMILY_MEMBERS}), пригласить ещё кого-то нельзя.</Notice>}
      </>}
    </Page>
  )
}
