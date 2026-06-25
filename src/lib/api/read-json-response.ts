export const readJsonResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Empty response from server (${response.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.trim().slice(0, 180);
    throw new Error(snippet || `Invalid server response (${response.status}).`);
  }
};