type JwtPayload = {
  sub?: string;
  email?: string;
  exp?: number;
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

export const parseJwtPayload = (token: string): JwtPayload | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
};

export const isJwtNotExpired = (token: string, skewSeconds = 30): boolean => {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp > Math.floor(Date.now() / 1000) + skewSeconds;
};

export const getUserFromAccessToken = (accessToken: string): { id: string; email?: string } | null => {
  const payload = parseJwtPayload(accessToken);
  if (!payload?.sub || !isJwtNotExpired(accessToken)) return null;
  return { id: payload.sub, email: payload.email };
};