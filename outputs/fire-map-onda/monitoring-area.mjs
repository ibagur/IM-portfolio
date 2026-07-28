export const MAP_REFERENCE_COORDS = Object.freeze([39.9449883, -0.247279]);
export const MAP_REFERENCE_ZOOM = 14;

// Southern monitoring anchor: official AEMET municipal coordinates for
// la Vall d'Uixó. This does not change the map's initial view.
export const VALL_DUIXO_COORDS = Object.freeze([39.82421754, -0.22806489]);

// The hotspot filter deliberately extends beyond Vall d'Uixó so any FIRMS
// detections approaching or passing the town are retained in the snapshot.
export const HOTSPOT_MONITORING_EXTENT = Object.freeze({
  west: -0.42,
  south: 39.78,
  east: -0.08,
  north: 40.11,
});

export function extentContains([latitude, longitude], extent = HOTSPOT_MONITORING_EXTENT) {
  return latitude >= extent.south
    && latitude <= extent.north
    && longitude >= extent.west
    && longitude <= extent.east;
}
