/**
 * @fileoverview Cloudflare R2 client via the S3-compatible API.
 *
 * Never cache the client — credentials are read fresh on every call so
 * environment variable changes take effect without a restart.
 */

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? ''
const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? ''

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

/** Returns a presigned URL that the client can PUT a file to directly. */
export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresInSeconds = 300,
): Promise<string> {
  const client = getR2Client()
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  })
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

/** Returns a presigned URL that allows downloading the object for a limited time. */
export async function getPresignedDownloadUrl(
  key: string,
  fileName: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const client = getR2Client()
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  })
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

/** Lists every object key in the bucket, paginating automatically. */
export async function listAllR2Keys(): Promise<string[]> {
  const client = getR2Client()
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.NextContinuationToken
  } while (continuationToken)
  return keys
}

/** Permanently removes an object from R2. */
export async function deleteR2Object(key: string): Promise<void> {
  const client = getR2Client()
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
