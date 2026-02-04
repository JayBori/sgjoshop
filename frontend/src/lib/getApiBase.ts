export function getApiBase(): string {
  // On server (Next.js SSR/route handlers), return absolute backend URL
  if (typeof window === 'undefined') {
    return process.env.BACK_API || 'http://127.0.0.1:8000';
  }
  // On browser, call same-origin /api to avoid mixed-content/CORS
  return '/api';
}
