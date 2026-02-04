export function getApiBase(): string {
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.API_BASE) {
    return (window as any).__RUNTIME_CONFIG__.API_BASE as string;
  }
  return process.env.NEXT_PUBLIC_API_BASE || '';
}
