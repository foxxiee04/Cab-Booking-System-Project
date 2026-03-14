import { randomUUID } from 'crypto';

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  headers: Record<string, HeaderValue>;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
};

type Next = () => void;

export function createRequestContextMiddleware(headerName = 'x-request-id') {
  return (req: RequestLike, res: ResponseLike, next: Next) => {
    const existing = req.headers[headerName] ?? req.headers[headerName.toLowerCase()];
    const requestId = Array.isArray(existing) ? existing[0] : existing;
    const resolvedRequestId = requestId || randomUUID();

    req.headers[headerName] = resolvedRequestId;
    res.setHeader(headerName, resolvedRequestId);

    next();
  };
}