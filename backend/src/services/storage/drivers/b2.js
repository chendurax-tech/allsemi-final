import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

/*
  Backblaze B2 driver for private documents, through B2's S3-compatible
  API and the AWS SDK that the project already uses.

  The bucket must stay private ("Files in bucket are: Private" in
  Backblaze). Nothing here makes an object public and no public address
  of an object is ever built. Downloads use presigned GET URLs that
  expire after SIGNED_URL_TTL_SECONDS.

  The endpoint and the region come from the environment (B2_ENDPOINT,
  B2_REGION): the endpoint is the S3 endpoint of the bucket's region,
  https://s3.<region>.backblazeb2.com.

  The application key needs these capabilities on the bucket: readFiles
  and writeFiles, deleteFiles, and listFiles (to find the versions of a
  file when it is deleted, see remove below).
*/

// The AWS SDK is loaded when the driver is first created, so a machine
// that does not use B2 never loads it.
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
    ListObjectVersionsCommand: s3.ListObjectVersionsCommand,
    getSignedUrl: presigner.getSignedUrl,
  };
}

// `sdk` is only passed by the tests, which hand in a stand-in for the
// AWS SDK to check what the driver asks of it.
export async function createB2Driver(sdk) {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectVersionsCommand, getSignedUrl } = sdk || await loadSdk();
  const client = new S3Client({
    region: env.b2.region,
    endpoint: env.b2.endpoint,
    credentials: {
      accessKeyId: env.b2.accessKeyId,
      secretAccessKey: env.b2.secretAccessKey,
    },
    // The bucket name goes in the path, not in the host name:
    // https://s3.<region>.backblazeb2.com/<bucket>/<key>.
    forcePathStyle: true,
    // Newer AWS SDK versions add checksum headers by default that B2
    // does not accept. Only send or expect one when an operation
    // requires it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = env.b2.bucket;

  return {
    // Every key the bucket holds in any version, hidden ones included
    // (see listStoredFiles in privateFiles.js). Used by the showcase
    // cleanup to check that nothing is left behind.
    async list() {
      const keys = new Set();
      let KeyMarker;
      let VersionIdMarker;
      for (let page = 0; page < 1000; page += 1) {
        const listed = await client.send(new ListObjectVersionsCommand({ Bucket, ...(KeyMarker ? { KeyMarker, VersionIdMarker } : {}) }));
        for (const entry of [...(listed?.Versions || []), ...(listed?.DeleteMarkers || [])]) keys.add(entry.Key);
        if (!listed?.IsTruncated) break;
        KeyMarker = listed.NextKeyMarker;
        VersionIdMarker = listed.NextVersionIdMarker;
      }
      return [...keys].sort();
    },

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

    /*
      A B2 bucket keeps versions. Deleting a key without naming a
      version only hides the file: the bytes stay in the bucket. A
      removed resume must be gone, so every version of the key
      (including an earlier hide marker) is deleted by its version id.
      If the versions cannot be listed (the application key lacks
      listFiles) the plain delete is still sent, which hides the file,
      and the server log says that the bytes remain.
    */
    async remove(key) {
      let versions;
      try {
        const listed = await client.send(new ListObjectVersionsCommand({ Bucket, Prefix: key }));
        versions = [...(listed?.Versions || []), ...(listed?.DeleteMarkers || [])].filter((entry) => entry.Key === key && entry.VersionId);
      } catch (error) {
        await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
        logger.warn('storage.b2_hidden_not_deleted', { error, reason: 'The versions of the file could not be listed, so it was hidden and its bytes remain in the bucket. Give the application key the listFiles capability.' });
        return;
      }
      // No version of the key: there is nothing to delete. A plain
      // delete would only add a hide marker for a file that is not there.
      for (const entry of versions) {
        await client.send(new DeleteObjectCommand({ Bucket, Key: key, VersionId: entry.VersionId }));
      }
    },
  };
}
