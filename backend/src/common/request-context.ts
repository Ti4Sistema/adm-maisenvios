import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

interface Actor {
  id: string;
  email: string;
}

interface RequestContext {
  requestId: string;
  ip: string | null;
  actor: Actor | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  // Em socket dual-stack o IPv4 chega como ::ffff:127.0.0.1.
  const ip = request.ip?.replace(/^::ffff:/, '') ?? null;
  storage.run({ requestId: randomUUID(), ip, actor: null }, next);
}

export function currentContext() {
  return storage.getStore() ?? null;
}

export function setActor(actor: Actor) {
  const context = storage.getStore();
  if (context) context.actor = actor;
}
