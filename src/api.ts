export const apiFetch = async (path: string, options?: RequestInit) => {
  const baseUrl = import.meta.env.VITE_GATEWAY_URL;
  if (!baseUrl) throw new Error('VITE_GATEWAY_URL is not configured — set it in your Render env.');
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
    try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText }; }
    throw { status: response.status, data: errorData };
  }
  return response.json();
};
