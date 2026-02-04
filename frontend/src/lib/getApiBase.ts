export function getApiBase(): string {
  // Use same-origin /api path to avoid mixed-content and CORS.
  return '/api';
}
