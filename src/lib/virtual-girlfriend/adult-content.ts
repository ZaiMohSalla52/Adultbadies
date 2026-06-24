const parseBool = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

/** Adult Badies defaults to fully adult-capable chat images. Set VG_ALLOW_ADULT_CONTENT=false to disable. */
export const isVirtualGirlfriendAdultContentEnabled = () =>
  parseBool(process.env.VG_ALLOW_ADULT_CONTENT, true);

export const EXPLICIT_IMAGE_REQUEST_PATTERN =
  /\b(nude|naked|topless|nsfw|explicit|lingerie|underwear|panties|see your body|show your body|without clothes|undressed|full body|sensual|erotic|sexy pic|hot pic|send me your)\b/i;

export const detectExplicitImageIntent = (message: string) =>
  isVirtualGirlfriendAdultContentEnabled() && EXPLICIT_IMAGE_REQUEST_PATTERN.test(message);