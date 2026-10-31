import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { Avatar } from '@/components/Avatar'
import { useIdentity } from '@/identity/context'
import { MAX_FAMILY_MEMBERS, ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useGetFamilyConnectionsQuery, useSendFamilyConnectionRequestMutation, useDisconnectFamilyMutation } from '@/store/familyConnections'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { useInFlight } from '@/lib/useInFlight'
import { ConnectionContent, ConnectionIntro, ConnectionList, Count, FamilyAction, FamilyCode, FamilyHeading, FamilyIdentity, FamilyMemberLink, FamilyName, IconTile, Member, MemberMeta, MemberName, Members, Panel, RequestsLink, SectionTabs, Tab, StatusText, EmptyState } from './styles'
import { EditLink, Head } from './styles'

function membersLabel(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'участников' : last === 1 ? 'участник' : last >= 2 && last <= 4 ? 'участника' : 'участников'
  return `${count} ${word}`
}

function ConnectionsTab() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const connectionQuery = useGetFamilyConnectionsQuery()
  const [sendRequest, sendState] = useSendFamilyConnectionRequestMutation()
  const [disconnect, disconnectState] = useDisconnectFamilyMutation()
  const [formOpen, setFormOpen] = useState(false)
  const [familyCode, setFamilyCode] = useState('')
  const [surname, setSurname] = useState('')
  const confirm = useConfirm()
  const guard = useInFlight()
  const adult = identity?.role !== 'child'
  const requests = connectionQuery.data?.requests ?? []
  const savedSurname = connectionQuery.data?.surname?.trim() ?? ''
  const displaySurname = savedSurname || surname.trim()

  const submitRequest = guard(async () => {
    await sendRequest({ familyCode: familyCode.trim(), surname: displaySurname }).unwrap()
    setFamilyCode('')
    setSurname('')
    setFormOpen(false)
  })

  return (
    <ConnectionContent>
      <ConnectionIntro>
        <IconTile aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></svg>
        </IconTile>
        <div><strong>Семьи рядом</strong><span>Планируйте события, играйте и общайтесь вместе.</span></div>
      </ConnectionIntro>

      {connectionQuery.isError && !connectionQuery.data && <Notice $tone="error">Не удалось загрузить связи. Проверьте интернет и попробуйте ещё раз.</Notice>}
      {connectionQuery.isLoading && !connectionQuery.data && <StatusText>Загружаем связи…</StatusText>}

      {!!connectionQuery.data?.connections.length && <>
        <FamilyHeading><h2>Связанные семьи</h2><Count>{connectionQuery.data.connections.length}</Count></FamilyHeading>
        <ConnectionList>
          {connectionQuery.data.connections.map((family) => <Panel key={family.familyId}>
            <FamilyIdentity>
              <IconTile aria-hidden><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3.5a4 4 0 0 1 0 7.8M20 21v-2a4 4 0 0 0-3-3.87" /></svg></IconTile>
              <div><FamilyName>{family.surname ? `Семья ${family.surname}` : 'Связанная семья'}</FamilyName><StatusText>{membersLabel(family.members.length)}</StatusText></div>
              <Count>{family.members.length}</Count>
            </FamilyIdentity>
            <Members>
              {family.members.map((member) => <Member key={member.id} to={`/family/${member.id}`}>
                <Avatar name={member.name} seed={member.id} src={member.avatar} size="2.5rem" />
                <MemberMeta><MemberName>{member.name}</MemberName><StatusText>{ROLE_LABELS[member.role]}</StatusText></MemberMeta>
                <span aria-hidden className="chevron">›</span>
              </Member>)}
            </Members>
            {profile?.me.isOwner && <Button $variant="text" onClick={guard(async () => {
              if (await confirm({ title: 'Разорвать связь?', message: 'Семьи потеряют доступ к общим событиям и играм.', confirmLabel: 'Разорвать', danger: true })) await disconnect(family.familyId).unwrap().catch(() => {})
            })}>Разорвать связь</Button>}
          </Panel>)}
        </ConnectionList>
      </>}

      {connectionQuery.data && connectionQuery.data.connections.length === 0 && <EmptyState>
        <IconTile aria-hidden><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></svg></IconTile>
        <strong>Пока нет связанных семей</strong>
        <span>Принятые запросы появятся здесь вместе со всеми участниками семьи.</span>
      </EmptyState>}

      {adult && <>
        <FamilyAction type="button" aria-expanded={formOpen} onClick={() => setFormOpen((open) => !open)}>
          <IconTile aria-hidden><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></IconTile>
          <span><strong>Подключить семью</strong><small>Отправить запрос по коду</small></span>
          <span aria-hidden className="chevron">{formOpen ? '⌃' : '›'}</span>
        </FamilyAction>
        {formOpen && <Panel>
          <div className="panel-heading"><h2>Новый запрос</h2><p>Его сможет принять только взрослый из другой семьи.</p></div>
          <Field label="Код другой семьи"><Input value={familyCode} onChange={(event) => setFamilyCode(event.target.value)} maxLength={32} autoCapitalize="characters" autoComplete="off" placeholder="Например, A1B2C3" /></Field>
          {savedSurname ? <div className="surname-summary"><small>Ваша семья будет указана как</small><strong>{`Семья ${savedSurname}`}</strong></div> : <Field label="Фамилия вашей семьи" hint="Её увидит семья, которой вы отправляете запрос."><Input value={surname} onChange={(event) => setSurname(event.target.value)} maxLength={80} autoCapitalize="words" placeholder="Например, Ивановы" /></Field>}
          {sendState.isError && <Notice $tone="error">Не удалось отправить запрос. Проверьте код семьи и попробуйте ещё раз.</Notice>}
          <Button $variant="primary" disabled={sendState.isLoading || !familyCode.trim() || !displaySurname} onClick={submitRequest}>{sendState.isLoading ? 'Отправляем…' : 'Отправить запрос'}</Button>
        </Panel>}
        <RequestsLink to="/family/requests">
          <IconTile aria-hidden><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 7l8 6 8-6" /></svg></IconTile>
          <span><strong>Запросы</strong><small>Входящие и отправленные</small></span>
          {requests.length > 0 && <Count>{requests.length}</Count>}
          <span aria-hidden className="chevron">›</span>
        </RequestsLink>
        {disconnectState.isError && <Notice $tone="error">Не удалось обновить связь. Попробуйте ещё раз.</Notice>}
      </>}
      {!adult && <Notice>Связанные семьи доступны для просмотра. Отправлять запросы могут только взрослые.</Notice>}
    </ConnectionContent>
  )
}

export default function Family() {
  const { identity } = useIdentity()
  const { data, failed } = useProfile()
  const [tab, setTab] = useState<'family' | 'connections'>('family')
  const connections = useGetFamilyConnectionsQuery(undefined, { skip: !identity })

  if (!identity) return <Navigate to="/" replace />
  const pendingCount = identity.role === 'child' ? 0 : connections.data?.requests.length ?? 0

  return (
    <Page>
      <Head>
        <h1>Ваша семья</h1>
        {data?.me.isOwner && <EditLink to="/family/edit">Изменить</EditLink>}
      </Head>
      <SectionTabs aria-label="Раздел семьи">
        <Tab type="button" $active={tab === 'family'} aria-pressed={tab === 'family'} onClick={() => setTab('family')}>Моя семья</Tab>
        <Tab type="button" $active={tab === 'connections'} aria-pressed={tab === 'connections'} onClick={() => setTab('connections')}>
          Связи{pendingCount > 0 && <Count>{pendingCount}</Count>}
        </Tab>
      </SectionTabs>

      {tab === 'connections' ? <ConnectionsTab /> : <>
        {identity.role !== 'child' && <FamilyCode>
          <div><small>КОД ВАШЕЙ СЕМЬИ</small><code>{identity.familyCode}</code></div>
          <span>Чтобы вас нашли</span>
        </FamilyCode>}
        <FamilyHeading><h2>Участники</h2>{data && <StatusText>{`${data.members.length} из ${MAX_FAMILY_MEMBERS}`}</StatusText>}</FamilyHeading>
        {failed && !data && <Notice $tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
        {!data && !failed && <StatusText>Загрузка…</StatusText>}
        <Members>
          {data?.members.map((member) => <li key={member.id}>
            <FamilyMemberLink to={member.id === identity.memberId ? '/profile' : `/family/${member.id}`}>
              <Avatar name={member.name} seed={member.id} src={member.avatar} size="2.75rem" />
              <MemberMeta><MemberName>{member.name}{member.id === identity.memberId && ' (вы)'}</MemberName><StatusText>{ROLE_LABELS[member.role]}{member.isOwner && ' · создатель'}</StatusText></MemberMeta>
              <span aria-hidden className="chevron">›</span>
            </FamilyMemberLink>
          </li>)}
        </Members>
        {data?.me.isOwner && data.members.length < MAX_FAMILY_MEMBERS && <MenuLink to="/family/invite" icon={<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" /></svg>}>Пригласить участника</MenuLink>}
        {data?.me.isOwner && data.members.length >= MAX_FAMILY_MEMBERS && <Notice $tone="muted">В семье максимум участников ({MAX_FAMILY_MEMBERS}), пригласить ещё кого-то нельзя.</Notice>}
      </>}
    </Page>
  )
}
