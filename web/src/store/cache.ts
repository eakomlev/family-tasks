import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Чей кэш лежит в памяти и кому разрешено сохранять: пока вход не прочитан, хранилище не перезаписывается
interface CacheState {
  // чей кэш был загружен из хранилища при старте
  hydratedFor: string | null
  // кто вошёл сейчас (null — пока неизвестно или вышли)
  owner: string | null
}

const slice = createSlice({
  name: 'cache',
  initialState: { hydratedFor: null, owner: null } as CacheState,
  reducers: {
    hydrated(state, action: PayloadAction<string>) {
      state.hydratedFor = action.payload
    },
    ownerChanged(state, action: PayloadAction<string | null>) {
      state.owner = action.payload
    },
    reset(state) {
      state.hydratedFor = null
      state.owner = null
    },
  },
})

export const { hydrated, ownerChanged, reset } = slice.actions
export const cacheReducer = slice.reducer
