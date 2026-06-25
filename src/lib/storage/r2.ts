import crypto from 'node:crypto';
import { env } from '@/lib/env';


const hmac = (key: crypto.BinaryLike, data: string) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();
const hashHex = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');

const signKey = (secret: string, date: string, region: string, service: string) => {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
};

const getRequired = (v: string | undefined, key: string) => {
  if (!v) throw new Error(`${key} is not configured.`);
  return v;
};

const signR2Request = (input: { method: 'PUT' | 'DELETE'; key: string; body?: Buffer; contentType?: string }) => {
  const accountId = getRequired(env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID');
  const accessKeyId = getRequired(env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequired(env.R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY');
  const bucket = getRequired(env.R2_BUCKET_NAME, 'R2_BUCKET_NAME');
  const endpointHost = `${accountId}.r2.cloudflarestorage.com`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const canonicalUri = `/${bucket}/${input.key}`;
  const payloadHash = hashHex(input.body ?? '');

  const canonicalHeaders = [
    ...(input.contentType ? [`content-type:${input.contentType}`] : []),
    `host:${endpointHost}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');

  const signedHeaders = [
    ...(input.contentType ? 'content-type;' : ''),
    'host;x-amz-content-sha256;x-amz-date',
  ].join('');

  const canonicalRequest = [
    input.method,
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashHex(canonicalRequest)].join('\n');
  const signature = crypto.createHmac('sha256', signKey(secretAccessKey, dateStamp, region, service)).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${endpointHost}${canonicalUri}`,
    headers: {
      Host: endpointHost,
      ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
      ...(input.body ? { 'Content-Length': String(input.body.byteLength) } : {}),
    },
    body: input.body,
    bucket,
  };
};

export const uploadToR2 = async (input: { key: string; body: Buffer; contentType: string }) => {
  const signed = signR2Request({ method: 'PUT', key: input.key, body: input.body, contentType: input.contentType });

  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: new Uint8Array(input.body),
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status}): ${await response.text()}`);
  }

  return {
    provider: 'cloudflare_r2',
    key: input.key,
    bucket: signed.bucket,
  };
};

/** Best-effort delete; logs and swallows errors so DB deletion is not blocked. */
export const deleteFromR2 = async (key: string) => {
  const trimmed = key.trim();
  if (!trimmed) return;

  try {
    const signed = signR2Request({ method: 'DELETE', key: trimmed });
    const response = await fetch(signed.url, { method: 'DELETE', headers: signed.headers });
    if (!response.ok && response.status !== 404) {
      console.warn('[storage] R2 delete failed', { key: trimmed, status: response.status });
    }
  } catch (error) {
    console.warn('[storage] R2 delete error', { key: trimmed, error });
  }
};