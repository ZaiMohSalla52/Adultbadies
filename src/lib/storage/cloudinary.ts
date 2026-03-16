import crypto from 'node:crypto';
import { env } from '@/lib/env';

const getRequired = (v: string | undefined, key: string) => {
  if (!v) throw new Error(`${key} is not configured.`);
  return v;
};

const toDataUri = (bytes: Buffer, mimeType: string) => `data:${mimeType};base64,${bytes.toString('base64')}`;

export const uploadToCloudinary = async (input: {
  bytes: Buffer;
  mimeType: string;
  folderPath: string;
  publicId: string;
}) => {
  const cloudName = getRequired(env.CLOUDINARY_CLOUD_NAME, 'CLOUDINARY_CLOUD_NAME');
  const apiKey = getRequired(env.CLOUDINARY_API_KEY, 'CLOUDINARY_API_KEY');
  const apiSecret = getRequired(env.CLOUDINARY_API_SECRET, 'CLOUDINARY_API_SECRET');
  const folderRoot = env.CLOUDINARY_FOLDER || 'adultbadiesvirtual-girlfriend';

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${folderRoot}/${input.folderPath}`;
  const publicId = `${folder}/${input.publicId}`;

  const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const form = new FormData();
  form.append('file', toDataUri(input.bytes, input.mimeType));
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('public_id', publicId);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Cloudinary upload failed (${res.status}): ${await res.text()}`);
  }

  const payload = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    width?: number;
    height?: number;
  };

  if (!payload.secure_url) {
    throw new Error('Cloudinary upload response missing secure_url.');
  }

  return {
    provider: 'cloudinary',
    deliveryUrl: payload.secure_url,
    publicId: payload.public_id ?? publicId,
    width: payload.width ?? null,
    height: payload.height ?? null,
  };
};
