// User-supplied Google Maps view for the current El Saler fires.
export const MAP_REFERENCE_COORDS = Object.freeze([39.3678262, -0.3309518]);
export const MAP_REFERENCE_ZOOM = 15;

// Operational collection window around El Saler and the southern edge of
// Valencia. It is intentionally wider than the initial viewport so nearby
// detections remain available through the "all detections" control.
export const HOTSPOT_MONITORING_EXTENT = Object.freeze({
  west: -0.46,
  south: 39.27,
  east: -0.20,
  north: 39.48,
});

export function extentContains([latitude, longitude], extent = HOTSPOT_MONITORING_EXTENT) {
  return latitude >= extent.south
    && latitude <= extent.north
    && longitude >= extent.west
    && longitude <= extent.east;
}
