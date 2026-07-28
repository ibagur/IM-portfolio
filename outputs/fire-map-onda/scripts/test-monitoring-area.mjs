import assert from "node:assert/strict";
import {
  HOTSPOT_MONITORING_EXTENT,
  MAP_REFERENCE_COORDS,
  MAP_REFERENCE_ZOOM,
  VALL_DUIXO_COORDS,
  extentContains,
} from "../monitoring-area.mjs";

assert.deepEqual(MAP_REFERENCE_COORDS, [39.9449883, -0.247279], "the initial map centre must remain unchanged");
assert.equal(MAP_REFERENCE_ZOOM, 14, "the initial map zoom must remain unchanged");
assert.ok(extentContains(VALL_DUIXO_COORDS), "the hotspot extent must include Vall d'Uixó");
assert.ok(HOTSPOT_MONITORING_EXTENT.south < VALL_DUIXO_COORDS[0], "the hotspot extent should continue south of Vall d'Uixó");

console.log("monitoring-area tests passed");
