import { disconnectFamily, getFamilyConnections, respondFamilyConnectionRequest, sendFamilyConnectionRequest, type FamilyConnectionsData } from '@/api'
import { api, fromApi } from './api'

export const familyConnectionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getFamilyConnections: build.query<FamilyConnectionsData, void>({ queryFn: fromApi((token) => getFamilyConnections(token)), providesTags: ['Me'] }),
    sendFamilyConnectionRequest: build.mutation<{ id: string }, { familyCode: string; surname: string }>({ queryFn: fromApi((token, arg) => sendFamilyConnectionRequest(token, arg.familyCode, arg.surname)), invalidatesTags: ['Me'] }),
    respondFamilyConnectionRequest: build.mutation<void, { id: string; action: 'accept' | 'reject'; surname?: string }>({ queryFn: fromApi((token, arg) => respondFamilyConnectionRequest(token, arg.id, arg.action, arg.surname)), invalidatesTags: ['Me'] }),
    disconnectFamily: build.mutation<void, string>({ queryFn: fromApi((token, id) => disconnectFamily(token, id)), invalidatesTags: ['Me', 'Games', 'Events', 'Chats'] }),
  }),
})
export const { useGetFamilyConnectionsQuery, useSendFamilyConnectionRequestMutation, useRespondFamilyConnectionRequestMutation, useDisconnectFamilyMutation } = familyConnectionsApi
