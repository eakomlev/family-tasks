// Адреса сервера задаются при сборке (EXPO_PUBLIC_API_URL): для разработки адрес компьютера в сети, для прода https://домен.
// По этому адресу работают и API (`/api`), и WebSocket, и фото (`/media`); ссылки приглашений тоже строятся от него.
const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'

export const API_URL = raw.replace(/\/+$/, '')
