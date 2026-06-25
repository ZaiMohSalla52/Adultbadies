const parseBool = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

/** Adult Badies defaults to fully adult-capable chat images. Set VG_ALLOW_ADULT_CONTENT=false to disable. */
export const isVirtualGirlfriendAdultContentEnabled = () =>
  parseBool(process.env.VG_ALLOW_ADULT_CONTENT, true);

/** Broad explicit / anatomy photo intent — drives Face Gen routing and exposure parsing. */
export const EXPLICIT_IMAGE_REQUEST_PATTERN =
  /\b(nude|naked|topless|nsfw|explicit|lingerie|underwear|panties|thong|g[\s-]?string|see your body|show your body|without clothes|undressed|full body|sensual|erotic|sexy pic|hot pic|send me your|tits|titties|breasts|boobs|nipples|areola|cleavage|bare chest|flash me|spread|ass|butt|booty|bum|rear|backside|buttocks|cheeks|pussy|vagina|cunt|on all fours|bend over|bent over|doggy|spread legs|spread eagle|strip for me|take it off|no panties|panties off|pull your panties|dick|cock|penis|shirtless|no bra)\b/i;

export const detectExplicitImageIntent = (message: string) =>
  isVirtualGirlfriendAdultContentEnabled() && EXPLICIT_IMAGE_REQUEST_PATTERN.test(message.trim());