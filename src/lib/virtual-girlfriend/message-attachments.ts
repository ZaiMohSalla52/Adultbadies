import type {
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageAttachment,
} from '@/lib/virtual-girlfriend/types';
import { VIRTUAL_GIRLFRIEND_IMAGE_CATEGORIES } from '@/lib/virtual-girlfriend/types';

const isImageCategory = (value: unknown): value is VirtualGirlfriendImageCategory =>
  typeof value === 'string'
  && (VIRTUAL_GIRLFRIEND_IMAGE_CATEGORIES as readonly string[]).includes(value);

const isAttachmentSource = (
  value: unknown,
): value is VirtualGirlfriendMessageAttachment['source'] =>
  value === 'gallery-reuse' || value === 'fresh-generation';

const normalizeAttachment = (raw: unknown): VirtualGirlfriendMessageAttachment | null => {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const imageId = String(record.imageId ?? record.image_id ?? '').trim();
  const imageUrl = String(record.imageUrl ?? record.image_url ?? '').trim();
  if (!imageId || !imageUrl) return null;

  const category = isImageCategory(record.category) ? record.category : 'selfie';
  const source = isAttachmentSource(record.source) ? record.source : 'fresh-generation';

  return {
    kind: 'image',
    category,
    imageId,
    imageUrl,
    width: typeof record.width === 'number' ? record.width : null,
    height: typeof record.height === 'number' ? record.height : null,
    source,
    promptHash: typeof record.promptHash === 'string'
      ? record.promptHash
      : typeof record.prompt_hash === 'string'
        ? record.prompt_hash
        : undefined,
    locked: record.locked === true,
  };
};

export const normalizeMessageAttachments = (raw: unknown): VirtualGirlfriendMessageAttachment[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAttachment).filter((attachment): attachment is VirtualGirlfriendMessageAttachment => Boolean(attachment));
};

export const unlockAttachmentInList = (
  attachments: VirtualGirlfriendMessageAttachment[],
  imageId: string,
): VirtualGirlfriendMessageAttachment[] =>
  attachments.map((attachment) =>
    attachment.imageId === imageId ? { ...attachment, locked: false } : attachment,
  );