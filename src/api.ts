// Talks ONLY to the operator's own gateway (VITE_GATEWAY_URL).
// The secret API key lives in the gateway, never in this bundle.
export const apiFetch = async (path: string, options?: RequestInit) => {
  const baseUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080/v1';
  const storefrontToken = import.meta.env.VITE_STOREFRONT_TOKEN;

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(storefrontToken ? { 'x-storefront-token': storefrontToken } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: response.statusText };
    }
    throw { status: response.status, data: errorData };
  }

  return response.json();
};
