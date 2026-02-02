/**
 * Extract a human-readable error message from a Clerk error response.
 * Falls back to the provided default if the error shape is unexpected.
 */
export function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (typeof err !== 'object' || err === null || !('errors' in err)) {
    return fallback;
  }

  const { errors } = err;
  if (!Array.isArray(errors) || errors.length === 0) {
    return fallback;
  }

  const first: unknown = errors[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    'message' in first &&
    typeof first.message === 'string'
  ) {
    return first.message;
  }

  return fallback;
}
