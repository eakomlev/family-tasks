import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import type { Config } from './config.js'

export interface StoredObject {
  body: Readable
  size: number
  etag: string | undefined
  contentType: string
  // при частичном чтении: «bytes 0-99/1000»; иначе не задано
  contentRange?: string
}

// Запрошенный отрезок байт (включительно); end не задан: до конца
export interface ByteRange {
  start: number
  end?: number
}

// Узкий интерфейс хранилища: сервис не знает, S3 это, диск или что-то ещё. Ключи вида «семья/файл/вариант.jpg».
export interface BlobStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  // кладёт файл с диска потоком (большие файлы и видео не читаются в память целиком)
  putFile(key: string, path: string, contentType: string): Promise<void>
  // null, если объекта нет
  get(key: string, range?: ByteRange): Promise<StoredObject | null>
  // удаляет всё указанное, отсутствующее не ошибка
  delete(keys: string[]): Promise<void>
  list(prefix: string): Promise<{ key: string; size: number }[]>
  // доступно ли хранилище (для проверки живости)
  ping(): Promise<void>
}

// Запрошенный отрезок лежит за пределами объекта
export class RangeNotSatisfiable extends Error {}

const isMissing = (err: unknown) =>
  err instanceof S3ServiceException && (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata.httpStatusCode === 404)

export function createS3Store(config: Config['s3']): BlobStore & { ensureBucket(): Promise<void> } {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  })
  const Bucket = config.bucket

  return {
    // Создаёт бакет, если его ещё нет. Хранилищу после запуска нужно время, поэтому вызывающий повторяет попытки.
    async ensureBucket() {
      try {
        await client.send(new CreateBucketCommand({ Bucket }))
      } catch (err) {
        if (err instanceof S3ServiceException && (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists')) return
        throw err
      }
    },
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }))
    },
    async putFile(key, path, contentType) {
      const { size } = await stat(path)
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: contentType }))
    },
    async get(key, range) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: key, ...(range ? { Range: `bytes=${range.start}-${range.end ?? ''}` } : {}) }))
        return {
          body: res.Body as Readable,
          size: res.ContentLength ?? 0,
          etag: res.ETag,
          contentType: res.ContentType ?? 'application/octet-stream',
          contentRange: res.ContentRange,
        }
      } catch (err) {
        if (isMissing(err)) return null
        if (range && err instanceof S3ServiceException && err.$metadata.httpStatusCode === 416) throw new RangeNotSatisfiable()
        throw err
      }
    },
    async delete(keys) {
      if (keys.length === 0) return
      await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }))
    },
    async list(prefix) {
      const out: { key: string; size: number }[] = []
      let token: string | undefined
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }))
        for (const o of res.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0 })
        token = res.IsTruncated ? res.NextContinuationToken : undefined
      } while (token)
      return out
    },
    async ping() {
      await client.send(new HeadBucketCommand({ Bucket }))
    },
  }
}
