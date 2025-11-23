import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Lazy initialization to avoid build-time errors
let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3) {
    if (
      !process.env.CLOUDFLARE_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_ACCESS_KEY_ID ||
      !process.env.CLOUDFLARE_SECRET_ACCESS_KEY
    ) {
      throw new Error('Cloudflare R2 credentials missing. Storage client will not work.');
    }
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType: string = 'image/png'
): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!bucket || !publicUrlBase) {
    throw new Error('R2 Bucket configuration missing');
  }

  try {
    const S3 = getS3Client();
    await S3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return `${publicUrlBase}/${key}`;
  } catch (error) {
    console.error('R2 Upload Error:', error);
    throw error;
  }
}

