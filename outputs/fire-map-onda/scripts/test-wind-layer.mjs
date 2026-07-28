import assert from "node:assert/strict";
import { MAP_REFERENCE_COORDS, VALL_DUIXO_COORDS } from "../monitoring-area.mjs";
import { createWindGrid, parseCurrentWindPayload, windTravelBearing } from "../wind-layer.mjs";

const grid = createWindGrid(MAP_REFERENCE_COORDS);
assert.equal(grid.length, 31, "the wind layer should contain a 6 by 5 corridor grid plus Vall d'Uixó");
assert.ok(grid.some(location => location.latitude === 39.9449883 && location.longitude === -0.247279), "the grid should retain a sample at Sant Francesc");
assert.ok(grid.some(location => location.latitude < 39.826 && location.longitude < -0.326), "the grid should cover the southern and western corridor bounds");
assert.ok(grid.some(location => location.latitude === VALL_DUIXO_COORDS[0] && location.longitude === VALL_DUIXO_COORDS[1]), "the grid should include an exact Vall d'Uixó sample");
assert.equal(windTravelBearing(0), 180, "wind from north should travel south");
assert.equal(windTravelBearing(90), 270, "wind from east should travel west");
assert.equal(windTravelBearing(270), 90, "wind from west should travel east");

const payload = grid.map((_, index) => ({
  current: {
    time: "2026-07-27T12:00",
    wind_speed_10m: 10 + index,
    wind_direction_10m: 180,
    wind_gusts_10m: 20 + index,
  },
}));
const parsed = parseCurrentWindPayload(payload, grid);
assert.equal(parsed.length, grid.length);
assert.equal(parsed[0].windSpeedKmh, 10);
assert.equal(parsed.at(-1).windGustKmh, 20 + grid.length - 1);
assert.equal(parsed[0].observedAt.toISOString(), "2026-07-27T12:00:00.000Z");
assert.throws(() => parseCurrentWindPayload(payload.slice(0, -1), grid), /Expected 31 wind locations/);
assert.throws(() => parseCurrentWindPayload([{ current: {} }], [grid[0]]), /incomplete/);

console.log("wind-layer tests passed");
