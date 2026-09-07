// Native Browser S3 Client using Web Crypto API (SubtleCrypto)
// Supports direct S3-compatible uploads to Supabase Storage S3 endpoints

const S3_KEY_ID = (import.meta.env.VITE_SUPABASE_S3_ACCESS_KEY_ID as string) || '';
const S3_SECRET = (import.meta.env.VITE_SUPABASE_S3_SECRET_ACCESS_KEY as string) || '';
const S3_HOST = (import.meta.env.VITE_SUPABASE_S3_HOST as string) || 'lrlcyvkoitqthiypxjiq.storage.supabase.co';
const BUCKET = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || 'bamburi111';

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf: BufferSource =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : (data instanceof ArrayBuffer ? data : (data.buffer as ArrayBuffer));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(keyData: Uint8Array | string, data: Uint8Array | string): Promise<Uint8Array> {
  const keyBuf: BufferSource =
    typeof keyData === 'string'
      ? new TextEncoder().encode(keyData)
      : (keyData.buffer as ArrayBuffer);
  const dataBuf: BufferSource =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : (data.buffer as ArrayBuffer);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuf);
  return new Uint8Array(signature);
}

export async function uploadToS3(
  fileKey: string,
  file: File | Blob | string,
  contentType = 'application/octet-stream'
): Promise<{ success: boolean; url: string; error?: string }> {
  if (!S3_KEY_ID || !S3_SECRET) {
    return { success: false, url: '', error: 'S3 credentials not configured' };
  }

  try {
    const fileBuffer = typeof file === 'string'
      ? new TextEncoder().encode(file)
      : await file.arrayBuffer();

    const path = `/storage/v1/s3/${BUCKET}/${fileKey}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'us-east-1';
    const service = 's3';

    const payloadHash = await sha256Hex(fileBuffer);
    const canonicalHeaders = `content-type:${contentType}\nhost:${S3_HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    const kDate = await hmacSha256('AWS4' + S3_SECRET, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const signatureBytes = await hmacSha256(kSigning, stringToSign);
    const signature = Array.from(signatureBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const authorization = `AWS4-HMAC-SHA256 Credential=${S3_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const targetUrl = `https://${S3_HOST}${path}`;
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        Host: S3_HOST,
        'Content-Type': contentType,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        Authorization: authorization,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`S3 upload failed (${response.status}):`, errorText);
      return { success: false, url: '', error: `S3 error (${response.status})` };
    }

    return {
      success: true,
      url: targetUrl,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('S3 upload exception:', errorMsg);
    return { success: false, url: '', error: errorMsg };
  }
}
