import assert from "node:assert/strict";
import {
  HOTSPOT_MONITORING_EXTENT,
  MAP_REFERENCE_COORDS,
  MAP_REFERENCE_ZOOM,
  extentContains,
} from "../monitoring-area.mjs";

assert.deepEqual(MAP_REFERENCE_COORDS, [39.3678262, -0.3309518], "the map must use the supplied El Saler centre");
assert.equal(MAP_REFERENCE_ZOOM, 15, "the initial map zoom should show the supplied centre and nearby detections together");
assert.ok(extentContains(MAP_REFERENCE_COORDS), "the hotspot extent must contain the El Saler centre");
assert.ok(HOTSPOT_MONITORING_EXTENT.south < MAP_REFERENCE_COORDS[0]);
assert.ok(HOTSPOT_MONITORING_EXTENT.north > MAP_REFERENCE_COORDS[0]);
assert.ok(HOTSPOT_MONITORING_EXTENT.west < MAP_REFERENCE_COORDS[1]);
assert.ok(HOTSPOT_MONITORING_EXTENT.east > MAP_REFERENCE_COORDS[1]);

console.log("monitoring-area tests passed");
