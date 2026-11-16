/**
 * Overland Navigator toolbar buttons (Load / Save) and grade overlays.
 * Ported from the legacy app's file_bar.js + core/navigator.js.
 */
import * as E from 'app/components/elements';
import { MapContext } from 'app/context/map_context';
import { newFeatureId } from 'app/lib/id';
import {
  fetchData,
  fetchOverlay,
  getToken,
  NAVIGATOR_OVERLAY_IDS,
  postData,
  setToken
} from 'app/lib/navigator';
import { usePersistence } from 'app/lib/persistence/context';
import { generateNKeysBetween } from 'fractional-indexing';
import { useAtomValue } from 'jotai';
import type mapboxgl from 'mapbox-gl';
import { memo, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { dataAtom } from 'state/jotai';
import type { FeatureCollection } from 'types';
import { UWrappedFeature } from 'types';

const OVERLAY_PAINT: mapboxgl.LinePaint = {
  'line-width': 6,
  'line-emissive-strength': 1,
  'line-color': [
    'match',
    ['get', 'grade'],
    0,
    '#A2FF25', // Grade 0 → Easy
    1,
    '#A2FF25', // Grade 1 → Easy
    2,
    '#FFDD00', // Grade 2 → Medium
    3,
    '#EB3B1A', // Grade 3 → Hard
    4,
    '#EB3B1A', // Grade 4 → Hard
    '#A2FF25' // Default → Easy
  ]
};

type GeoJSONData = Parameters<mapboxgl.GeoJSONSource['setData']>[0];

// First layer added by the editor on top of the basemap; overlays go beneath it.
const FIRST_EDITOR_LAYER = 'features-fill';

function addOverlays(
  map: mapboxgl.Map,
  overlays: Map<string, FeatureCollection>
) {
  for (const [overlayId, data] of overlays) {
    const id = `overlay-${overlayId}`;
    const source = map.getSource<mapboxgl.GeoJSONSource>(id);
    if (source) {
      source.setData(data as GeoJSONData);
      continue;
    }
    map.addSource(id, { type: 'geojson', data: data as GeoJSONData });
    map.addLayer(
      { id, type: 'line', source: id, paint: OVERLAY_PAINT },
      map.getLayer(FIRST_EDITOR_LAYER) ? FIRST_EDITOR_LAYER : undefined
    );
  }
}

/**
 * Ask for a JWT if none is stored. Returns false if the user cancelled.
 */
function ensureToken(): boolean {
  if (getToken()) return true;
  const input = window.prompt(
    'Enter JWT token for private repositories (optional)'
  );
  if (input === null) return false;
  const token = input.trim();
  if (token.length > 0) setToken(token);
  return true;
}

export const NavigatorControls = memo(function NavigatorControls() {
  const pmap = useContext(MapContext);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { featureMap } = useAtomValue(dataAtom);
  // In-memory only: a page reload requires loading from the API again
  // before saving (blank save protection).
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overlays, setOverlays] = useState<Map<string, FeatureCollection>>(
    () => new Map()
  );

  // Basemap switches reload the whole style, so re-add overlays each time.
  useEffect(() => {
    const map = pmap?.map;
    if (!map || overlays.size === 0) return;
    const onStyleLoad = () => addOverlays(map, overlays);
    try {
      addOverlays(map, overlays);
    } catch {
      // Style still loading; the next style.load / idle will add them.
      map.once('idle', onStyleLoad);
    }
    map.on('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
      map.off('idle', onStyleLoad);
    };
  }, [pmap, overlays]);

  const replaceFeatures = useCallback(
    async (fc: FeatureCollection, note: string) => {
      // Never wipe the map on an unexpected response shape.
      if (!fc || !Array.isArray(fc.features)) {
        throw new Error('Unexpected response: no features array');
      }
      const features = fc.features;
      const ats = generateNKeysBetween(null, null, features.length);
      await transact({
        note,
        deleteFeatures: Array.from(featureMap.keys()),
        putFeatures: features.map((feature, i) => ({
          at: ats[i],
          id: newFeatureId(),
          feature
        }))
      });
    },
    [transact, featureMap]
  );

  const load = useCallback(async () => {
    if (!ensureToken()) return;
    setBusy(true);

    Promise.allSettled(
      NAVIGATOR_OVERLAY_IDS.map(
        async (id) => [id, await fetchOverlay(id)] as const
      )
    ).then((results) => {
      const loaded = new Map<string, FeatureCollection>();
      for (const r of results) {
        if (r.status === 'fulfilled') loaded.set(r.value[0], r.value[1]);
        // eslint-disable-next-line no-console
        else console.error('Error loading overlays:', r.reason);
      }
      setOverlays(loaded);
    });

    try {
      const data = await fetchData();
      await replaceFeatures(data, 'Loaded from Overland Navigator');
      setHasLoaded(true);
      toast.success(`Loaded ${data.features.length} features`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error loading data:', e);
      toast.error(`Error loading data: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [replaceFeatures]);

  const save = useCallback(async () => {
    if (!hasLoaded) {
      window.alert(
        'Data has not been loaded yet. Please load data before saving.'
      );
      return;
    }
    if (
      featureMap.size === 0 &&
      !window.confirm(
        'The map is empty. Saving will remove all data on Overland Navigator. Continue?'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const body = UWrappedFeature.toFeatureCollection(
        Array.from(featureMap.values())
      );
      const saved = await postData(body);
      await replaceFeatures(saved, 'Saved to Overland Navigator');
      toast.success('Data saved successfully!');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error saving data:', e);
      window.alert(`Error saving data: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [hasLoaded, featureMap, replaceFeatures]);

  return (
    <div className="flex items-center border-r border-gray-200 dark:border-gray-700 pr-2 mr-1">
      <span className="hidden lg:inline text-xs text-gray-500 pr-1">
        Navigator
      </span>
      <E.Button
        variant="quiet"
        aria-label="Load from Overland Navigator"
        disabled={busy}
        onClick={() => void load()}
      >
        Load
      </E.Button>
      <E.Button
        variant="quiet"
        aria-label="Save to Overland Navigator"
        disabled={busy}
        onClick={() => void save()}
      >
        Save
      </E.Button>
    </div>
  );
});
