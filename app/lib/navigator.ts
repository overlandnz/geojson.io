/**
 * Overland Navigator API client.
 *
 * Ported from the legacy app's src/core/navigator.js. Loads/saves the
 * FeatureCollection via the Navigator admin API and fetches the track
 * grade overlays.
 */
import type { FeatureCollection } from 'types';

export const NAVIGATOR_ENDPOINT: string =
  import.meta.env.VITE_NAVIGATOR_ENDPOINT || 'https://overlandnavigator.co.nz';

export const NAVIGATOR_OVERLAY_IDS = [
  'north_1',
  'north_2',
  'south_1',
  'south_2'
] as const;

const TOKEN_KEY = 'jwt';

export function getToken(): string | null {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) return null;

  // Validate the JWT expiry
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      // eslint-disable-next-line no-console
      console.warn('JWT token has expired');
      clearToken();
      return null;
    }
  } catch {
    // Not a decodable JWT; send it anyway and let the API decide.
  }
  return token;
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

export function clearToken() {
  setToken(null);
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${NAVIGATOR_ENDPOINT}${path}`, {
    ...init,
    headers: headers()
  });
  if (!res.ok) {
    throw new Error(`Navigator API ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function fetchOverlay(overlayId: string) {
  return request<FeatureCollection>(`/admin/geojson/overlay/${overlayId}`);
}

export function fetchData() {
  return request<FeatureCollection>('/admin/geojson/fetch');
}

export function postData(data: FeatureCollection) {
  return request<FeatureCollection>('/admin/geojson/post', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
