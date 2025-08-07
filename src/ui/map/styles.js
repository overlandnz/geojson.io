module.exports = [
  {
    title: 'Topographic',
    style: {
      version: 8,
      sources: {
        'nztopo-tiles': {
          type: 'raster',
          tiles: [
            'https://basemaps.linz.govt.nz/v1/tiles/topo-raster/WebMercatorQuad/{z}/{x}/{y}.webp?api=c01k0x5sjp2cqpdwcmsyddp1jed'
          ],
          scheme: 'xyz',
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'nztopo',
          type: 'raster',
          source: 'nztopo-tiles'
        }
      ]
    }
  },
  {
    title: 'Modern Topographic',
    style:
      'https://basemaps.linz.govt.nz/v1/styles/topographic.json?api=c01k0x5sjp2cqpdwcmsyddp1jed'
  },
  {
    title: 'Standard',
    style: 'mapbox://styles/mapbox/standard',
    config: {
      basemap: {
        show3dObjects: false
      }
    }
  },
  {
    title: 'Standard Satellite',
    style: 'mapbox://styles/mapbox/standard-satellite'
  },
  {
    title: 'Standard Light',
    style: 'mapbox://styles/mapbox/standard',
    config: {
      basemap: {
        show3dObjects: false,
        theme: 'monochrome'
      }
    }
  },
  {
    title: 'Standard Dark',
    style: 'mapbox://styles/mapbox/standard',
    config: {
      basemap: {
        show3dObjects: false,
        theme: 'monochrome',
        lightPreset: 'night'
      }
    }
  },
  {
    title: 'Outdoors',
    style: 'mapbox://styles/mapbox/outdoors-v12'
  },
  {
    title: 'OSM',
    style: {
      name: 'osm',
      version: 8,
      glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
      sources: {
        'osm-raster-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
      },
      layers: [
        {
          id: 'osm-raster-layer',
          type: 'raster',
          source: 'osm-raster-tiles',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    }
  }
];
