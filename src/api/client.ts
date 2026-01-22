const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:4000" : "/giftboard/api");

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers || {}),
  } as Record<string, string>;
  if (options?.body instanceof FormData) {
    delete headers["Content-Type"];
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
