import { describe, expect, it } from 'vitest';
import { getUserFromAccessToken, isJwtNotExpired, parseJwtPayload } from '@/lib/supabase/jwt';

const encodePayload = (payload: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
};

describe('jwt helpers', () => {
  it('parses payload claims', () => {
    const token = encodePayload({ sub: 'user-123', email: 'test@example.com', exp: 4_102_444_800 });
    expect(parseJwtPayload(token)).toEqual({
      sub: 'user-123',
      email: 'test@example.com',
      exp: 4_102_444_800,
    });
  });

  it('rejects expired tokens', () => {
    const token = encodePayload({ sub: 'user-123', exp: 1 });
    expect(isJwtNotExpired(token)).toBe(false);
    expect(getUserFromAccessToken(token)).toBeNull();
  });

  it('returns user from valid token', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = encodePayload({ sub: 'user-abc', email: 'a@b.com', exp });
    expect(getUserFromAccessToken(token)).toEqual({ id: 'user-abc', email: 'a@b.com' });
  });
});