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

type AnyGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: unknown;
};

function isPosition(p: unknown): boolean {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number'
  );
}

function lineProblem(c: unknown): string | null {
  if (!Array.isArray(c) || c.length < 2) return 'line needs 2+ points';
  return c.every(isPosition) ? null : 'invalid coordinate';
}

function polygonProblem(c: unknown): string | null {
  if (!Array.isArray(c) || c.length === 0) return 'polygon has no rings';
  for (const ring of c) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return 'polygon ring needs 4+ points';
    }
    if (!ring.every(isPosition)) return 'invalid coordinate';
  }
  return null;
}

/**
 * Returns why a geometry would be rejected by the Navigator API
 * (which converts to NetTopologySuite), or null if it's fine.
 */
export function geometryProblem(geometry: AnyGeometry | null): string | null {
  if (!geometry) return 'no geometry';
  const c = geometry.coordinates;
  const each = (check: (x: unknown) => string | null) => {
    if (!Array.isArray(c) || c.length === 0) return 'empty geometry';
    for (const part of c) {
      const p = check(part);
      if (p) return p;
    }
    return null;
  };
  switch (geometry.type) {
    case 'Point':
      return isPosition(c) ? null : 'point has no coordinates';
    case 'MultiPoint':
      return each((p) => (isPosition(p) ? null : 'invalid coordinate'));
    case 'LineString':
      return lineProblem(c);
    case 'MultiLineString':
      return each(lineProblem);
    case 'Polygon':
      return polygonProblem(c);
    case 'MultiPolygon':
      return each(polygonProblem);
    case 'GeometryCollection': {
      const g = geometry.geometries;
      if (!Array.isArray(g) || g.length === 0) return 'empty collection';
      for (const child of g as AnyGeometry[]) {
        const p = geometryProblem(child);
        if (p) return p;
      }
      return null;
    }
    default:
      return `unknown geometry type ${geometry.type}`;
  }
}
