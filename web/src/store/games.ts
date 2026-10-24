import { acceptGame, cancelGame, declineGame, getGame, inviteToGame, listGames, moveInGame, resignGame, type ChessMove, type Game, type GameKind } from '@/api'
import { api, fromApi } from './api'

// Игры. Ответ сервера на любое действие сразу кладётся в кэш игры, списки обновляются заново (и по сигналу сокета `games`).
export const gamesApi = api.injectEndpoints({
  endpoints: (build) => {
    // Мутация над игрой: возвращённая сервером игра заменяет прежнюю в кэше
    const action = (call: (token: string, id: string, arg: never) => Promise<{ game: Game }>) =>
      build.mutation<{ game: Game }, { id: string } & Record<string, unknown>>({
        queryFn: fromApi((token, { id, ...rest }: { id: string } & Record<string, unknown>) => call(token, id, rest as never)),
        async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
          try {
            const { data } = await queryFulfilled
            dispatch(gamesApi.util.updateQueryData('getGame', id, (draft) => void (draft.game = data.game)))
          } catch {
            /* ошибку показывает экран */
          }
        },
        invalidatesTags: ['Games'],
      })

    return {
      listGames: build.query<{ games: Game[] }, void>({
        queryFn: fromApi((token) => listGames(token)),
        providesTags: ['Games'],
      }),
      getGame: build.query<{ game: Game }, string>({
        queryFn: fromApi((token, id: string) => getGame(token, id)),
        providesTags: ['Games'],
      }),
      inviteToGame: build.mutation<{ game: Game }, { kind: GameKind; opponentId: string }>({
        queryFn: fromApi((token, { kind, opponentId }: { kind: GameKind; opponentId: string }) => inviteToGame(token, kind, opponentId)),
        invalidatesTags: ['Games'],
      }),
      acceptGame: action((token, id) => acceptGame(token, id)),
      declineGame: action((token, id) => declineGame(token, id)),
      cancelGame: action((token, id) => cancelGame(token, id)),
      resignGame: action((token, id) => resignGame(token, id)),
      moveInGame: action((token, id, move: Pick<ChessMove, 'from' | 'to'>) => moveInGame(token, id, move)),
    }
  },
})

export const {
  useListGamesQuery,
  useGetGameQuery,
  useInviteToGameMutation,
  useAcceptGameMutation,
  useDeclineGameMutation,
  useCancelGameMutation,
  useResignGameMutation,
  useMoveInGameMutation,
} = gamesApi
