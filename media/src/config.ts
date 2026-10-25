// Настройки сервиса из окружения. Секреты обязательны: без них сервис не стартует (иначе подпись была бы пустой).
export interface Config {
  port: number
  // подпись ссылок на файлы (общий секрет с server)
  secret: string
  // токен внутреннего API, который вызывает server
  internalToken: string
  maxUploadBytes: number
  // предел размера обычного файла (документ, архив и т. п.), не фото
  maxFileBytes: number
  // видео: предел размера загрузки и длительности (после проверки ffmpeg)
  maxVideoBytes: number
  maxVideoSeconds: number
  s3: { endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string; forcePathStyle: boolean }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const int = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: int(env.PORT, 3000),
    secret: required(env, 'MEDIA_SECRET'),
    internalToken: required(env, 'MEDIA_INTERNAL_TOKEN'),
    maxUploadBytes: int(env.MEDIA_MAX_UPLOAD_BYTES, 3 * 1024 * 1024),
    maxFileBytes: int(env.MEDIA_MAX_FILE_BYTES, 10 * 1024 * 1024),
    maxVideoBytes: int(env.MEDIA_MAX_VIDEO_BYTES, 100 * 1024 * 1024),
    maxVideoSeconds: int(env.MEDIA_MAX_VIDEO_SECONDS, 180),
    s3: {
      endpoint: required(env, 'S3_ENDPOINT'),
      region: env.S3_REGION || 'us-east-1',
      bucket: required(env, 'S3_BUCKET'),
      accessKey: required(env, 'S3_ACCESS_KEY'),
      secretKey: required(env, 'S3_SECRET_KEY'),
      // большинству самохостинговых S3 нужна адресация «хост/бакет/ключ»; для облачных можно отключить
      forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
    },
  }
}
