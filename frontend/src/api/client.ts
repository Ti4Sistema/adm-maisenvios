export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  // Para login e restauração da sessão, onde 401 é uma resposta esperada.
  expectUnauthorized?: boolean;
}

let handleUnauthorized = () => {};

export function onUnauthorized(handler: () => void) {
  handleUnauthorized = handler;
}

function buildUrl(path: string, query: ApiOptions['query'] = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `/api${path}${search ? `?${search}` : ''}`;
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  const message = data?.message;
  if (Array.isArray(message)) return message[0];
  return message ?? 'Não foi possível concluir a operação';
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query, expectUnauthorized } = options;
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && !expectUnauthorized) handleUnauthorized();
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return response.json();
}
