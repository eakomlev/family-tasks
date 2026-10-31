import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import styled from 'styled-components'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { useIdentity } from '@/identity/context'
import { useGetFamilyConnectionsQuery, useRespondFamilyConnectionRequestMutation } from '@/store/familyConnections'
import { useInFlight } from '@/lib/useInFlight'
import { EmptyState, IconTile, MemberMeta, MemberName, Panel, StatusText } from '@/pages/Family/styles'

const RequestList = styled.div`
  display: grid;
  gap: 0.75rem;
`

const RequestStatus = styled.span<{ $outgoing: boolean }>`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.35rem;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: ${({ $outgoing }) => ($outgoing ? 'var(--accent-soft)' : 'var(--lime)')};
  color: ${({ $outgoing }) => ($outgoing ? 'var(--accent)' : 'var(--on-lime)')};
  font-size: 0.75rem;
  font-weight: 800;
`

const RequestTop = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  > div:nth-child(2) { display: grid; flex: 1; min-width: 0; gap: 0.2rem; }
`

const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
  @media (max-width: 360px) { grid-template-columns: 1fr; }
`

export default function FamilyRequests() {
  const { identity } = useIdentity()
  const connectionQuery = useGetFamilyConnectionsQuery()
  const [respond, respondState] = useRespondFamilyConnectionRequestMutation()
  const [surname, setSurname] = useState('')
  const guard = useInFlight()
  const savedSurname = connectionQuery.data?.surname?.trim() ?? ''
  const requests = connectionQuery.data?.requests ?? []
  const incoming = requests.filter((request) => !request.outgoing)

  if (!identity) return <Navigate to="/" replace />
  if (identity.role === 'child') return <Navigate to="/family" replace />

  return (
    <Page>
      <PageHeader to="/family">Запросы</PageHeader>
      <StatusText>Примите запрос от другой семьи или проверьте статус отправленного.</StatusText>
      {connectionQuery.isLoading && !connectionQuery.data && <StatusText>Загружаем запросы…</StatusText>}
      {connectionQuery.isError && !connectionQuery.data && <Notice $tone="error">Не удалось загрузить запросы. Проверьте интернет и попробуйте ещё раз.</Notice>}

      {!!incoming.length && !savedSurname && <Panel>
        <RequestTop>
          <IconTile aria-hidden><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3.5a4 4 0 0 1 0 7.8M20 21v-2a4 4 0 0 0-3-3.87" /></svg></IconTile>
          <MemberMeta><MemberName>Укажите фамилию семьи</MemberName><StatusText>Её увидят участники связанных семей.</StatusText></MemberMeta>
        </RequestTop>
        <Field label="Фамилия вашей семьи"><Input value={surname} onChange={(event) => setSurname(event.target.value)} maxLength={80} autoCapitalize="words" placeholder="Например, Ивановы" /></Field>
      </Panel>}

      {connectionQuery.data && requests.length === 0 && <EmptyState>
        <IconTile aria-hidden><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 7l8 6 8-6" /></svg></IconTile>
        <strong>Запросов пока нет</strong>
        <span>Новые входящие и отправленные запросы будут собраны здесь.</span>
      </EmptyState>}

      <RequestList>
        {requests.map((request) => <Panel key={request.id}>
          <RequestTop>
            <IconTile aria-hidden><svg viewBox="0 0 24 24">{request.outgoing ? <><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></> : <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3.5a4 4 0 0 1 0 7.8M20 21v-2a4 4 0 0 0-3-3.87" /></>}</svg></IconTile>
            <MemberMeta><MemberName>{request.outgoing ? `Семья ${request.surname ?? request.familyCode}` : `Семья ${request.fromSurname}`}</MemberName><StatusText>{request.outgoing ? 'Получатель ещё не ответил.' : 'Хочет установить связь с вашей семьёй.'}</StatusText></MemberMeta>
          </RequestTop>
          <RequestStatus $outgoing={request.outgoing}>{request.outgoing ? 'Ожидает ответа' : 'Входящий запрос'}</RequestStatus>
          {!request.outgoing && <Actions>
            <Button $variant="primary" disabled={respondState.isLoading || (!savedSurname && !surname.trim())} onClick={guard(async () => { await respond({ id: request.id, action: 'accept', surname: savedSurname || surname.trim() || undefined }).unwrap().catch(() => {}) })}>Принять</Button>
            <Button disabled={respondState.isLoading} onClick={guard(async () => { await respond({ id: request.id, action: 'reject' }).unwrap().catch(() => {}) })}>Отклонить</Button>
          </Actions>}
        </Panel>)}
      </RequestList>
      {respondState.isError && <Notice $tone="error">Не удалось обработать запрос. Проверьте соединение и попробуйте ещё раз.</Notice>}
    </Page>
  )
}
