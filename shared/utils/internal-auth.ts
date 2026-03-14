type HeaderRequest = {
  header(name: string): string | undefined;
};

type JsonResponse = {
  status(code: number): JsonResponse;
  json(body: unknown): unknown;
};

type Next = () => void;

export function createInternalServiceAuth(getToken: () => string | undefined) {
  return (req: HeaderRequest, res: JsonResponse, next: Next) => {
    const internalToken = getToken()?.trim();

    if (!internalToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_TOKEN_NOT_CONFIGURED',
          message: 'INTERNAL_SERVICE_TOKEN not configured',
        },
      });
    }

    const provided = req.header('x-internal-token');
    if (!provided || provided !== internalToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_INTERNAL',
          message: 'Invalid internal token',
        },
      });
    }

    next();
  };
}