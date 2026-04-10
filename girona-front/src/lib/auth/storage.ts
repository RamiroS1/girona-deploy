export const ACCESS_TOKEN_KEY = "girona_access_token";
export const TOKEN_TYPE_KEY = "girona_token_type";

export type StoredAuth = {
  accessToken: string;
  tokenType: string;
};

function getStorage(remember: boolean) {
  if (typeof window === "undefined") return null;
  return remember ? window.localStorage : window.sessionStorage;
}

export function storeAuth(auth: StoredAuth, remember: boolean) {
  const storage = getStorage(remember);
  if (!storage) return;

  storage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  storage.setItem(TOKEN_TYPE_KEY, auth.tokenType);
}

export function readAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;

  const storages = [window.localStorage, window.sessionStorage] as const;
  for (const storage of storages) {
    const accessToken = storage.getItem(ACCESS_TOKEN_KEY);
    const tokenType = storage.getItem(TOKEN_TYPE_KEY) ?? "Bearer";
    if (accessToken) return { accessToken, tokenType };
  }

  return null;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_TYPE_KEY);
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_TYPE_KEY);
}

