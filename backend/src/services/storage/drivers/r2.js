import { env } from '../../../config/env.js';

/*
  Cloudflare R2 driver for private documents (S3-compatible API).

  The bucket must stay private: do not enable public access or attach
  a public r2.dev / custom domain to it. Downloads use presigned GET
  URLs that expire after SIGNED_URL_TTL_SECONDS.
*/

// The AWS SDK is loaded when the driver is first created, so a machine
// that does not use R2 never loads it.
async function loadSdk() {
  const [s3, presigner] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ]);
  return {
    S3Client: s3.S3Client,
    PutObjectCommand: s3.PutObjectCommand,
    GetObjectCommand: s3.GetObjectCommand,
    DeleteObjectCommand: s3.DeleteObjectCommand,
    getSignedUrl: presigner.getSignedUrl,
  };
}

// `sdk` is only passed by the tests, which hand in a stand-in for the
// AWS SDK to check what the driver asks of it.
export async function createR2Driver(sdk) {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl } = sdk || await loadSdk();
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
    // Newer AWS SDK versions add checksum headers by default that R2
    // does not accept. Only send or expect one when an operation
    // requires it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = env.r2.bucket;

  return {
    async put(key, buffer, mimeType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: mimeType }));
    },

    async signedUrl(key, { fileName, mimeType }) {
      // PDFs open in the browser; Word files download.
      const disposition = mimeType === 'application/pdf' ? 'inline' : 'attachment';
      const asciiName = String(fileName || 'document').replace(/[^\w .()-]/g, '_');
      const command = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentType: mimeType,
        ResponseContentDisposition: `${disposition}; filename="${asciiName}"`,
      });
      const url = await getSignedUrl(client, command, { expiresIn: env.signedUrlTtlSeconds });
      return { url, expiresIn: env.signedUrlTtlSeconds };
    },

    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
  };
}
