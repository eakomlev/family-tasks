import { createS3Store } from '../src/store.js'
import type { Config } from '../src/config.js'

export const TEST_BUCKET = 'media-test'

export const testS3 = (): Config['s3'] => ({
  endpoint: process.env.S3_TEST_ENDPOINT ?? 'http://localhost:8333',
  region: 'us-east-1',
  bucket: TEST_BUCKET,
  accessKey: process.env.S3_TEST_ACCESS_KEY ?? 'mediakey',
  secretKey: process.env.S3_TEST_SECRET_KEY ?? 'mediasecret',
  forcePathStyle: true,
})

export const testStore = () => createS3Store(testS3())

export const testConfig = (over: Partial<Config> = {}): Config => ({
  port: 0,
  secret: 'test-secret',
  internalToken: 'test-internal-token',
  maxUploadBytes: 3 * 1024 * 1024,
  maxFileBytes: 10 * 1024 * 1024,
  s3: testS3(),
  ...over,
})
