import { CookieOptions } from 'express';
import { env } from '../config/env';

export const SESSION_COOKIE = 'adm_session';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProduction,
    path: '/',
  };
}

export function readSessionToken(cookieHeader: string | undefined) {
  const prefix = `${SESSION_COOKIE}=`;
  const cookie = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie?.slice(prefix.length) ?? null;
}
