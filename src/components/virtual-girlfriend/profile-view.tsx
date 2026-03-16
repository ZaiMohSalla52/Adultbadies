import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

export const VirtualGirlfriendProfileView = ({
  companion,
  visualProfile,
  images,
}: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  images: VirtualGirlfriendCompanionImageRecord[];
}) => {
  const tags = companion.profile_tags ?? companion.persona_profile.vibeTags ?? [];
  const canonical = images.find((image) => image.image_kind === 'canonical') ?? null;
  const gallery = images.filter((image) => image.image_kind === 'gallery');

  return (
    <div className="app-page-stack">
      <Card className="app-page-header">
        <p className="chat-label">Virtual Girlfriend</p>
        <h1 className="my-0">{companion.name}</h1>
        <p className="my-0 text-muted">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
        <p className="my-0 text-xs text-muted">{companion.disclosure_label} • AI-generated photos</p>
      </Card>

      <Card className="app-surface-card space-y-3">
        <h2 className="my-0 text-base font-semibold">Profile portrait</h2>
        {canonical ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border">
            <Image src={canonical.delivery_url} alt={`${companion.name} profile portrait`} fill className="object-cover" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            Her image identity pack is still rendering. Refresh in a moment for premium portraits.
          </div>
        )}
      </Card>

      <Card className="app-surface-card space-y-3">
        <h2 className="my-0 text-base font-semibold">Gallery</h2>
        {gallery.length ? (
          <div className="grid grid-cols-2 gap-3">
            {gallery.map((image) => (
              <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                <Image src={image.delivery_url} alt={`${companion.name} gallery variant`} fill className="object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="my-0 text-sm text-muted">No gallery shots yet.</p>
        )}
      </Card>

      <Card className="app-surface-card space-y-3">
        <h2 className="my-0 text-base font-semibold">Her vibe</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              {tag}
            </span>
          ))}
        </div>
        {visualProfile ? (
          <p className="my-0 text-xs text-muted">
            Visual style {visualProfile.style_version} • identity continuity enabled for profile and gallery generations.
          </p>
        ) : null}
      </Card>

      <div className="flex gap-3">
        <Link href="/virtual-girlfriend/chat" className="ui-button">
          Start chatting
        </Link>
        <Link href="/virtual-girlfriend/setup" className="ui-button ui-button-ghost">
          Refine setup
        </Link>
      </div>
    </div>
  );
};
