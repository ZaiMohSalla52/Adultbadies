-- Speed up companion grid / card thumbnail lookups (canonical portraits only).
create index if not exists idx_companion_images_user_companion_canonical
  on public.ai_companion_images (user_id, companion_id, created_at desc)
  where image_kind = 'canonical' and delivery_url is not null;