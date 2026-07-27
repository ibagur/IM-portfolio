import assert from "node:assert/strict";
import { calculateRiskNowcast, destinationPoint, RISK_HORIZONS } from "../risk-model.mjs";

const now = new Date("2026-07-27T12:00:00Z");
const perimeterGeometry = {
  type: "Polygon",
  coordinates: [[[0, 0.01], [0.01, 0.01], [0.01, 0.02], [0, 0.02], [0, 0.01]]],
};
const weatherByHorizon = Object.fromEntries(RISK_HORIZONS.map(({ hours }) => [hours, {
  windSpeedKmh: 28,
  windGustKmh: 42,
  windDirection: 180,
  relativeHumidity: 18,
  precipitationMm: 0,
  soilMoisture: 0.08,
}]));
const fire = coordinates => ({ type: "Feature", geometry: { type: "Point", coordinates }, properties: { detected_at: "2026-07-27T11:00:00Z", frp_mw: 10 } });
const evaluate = coordinates => calculateRiskNowcast({ features: [fire(coordinates)], perimeterGeometry, weatherByHorizon, snapshotGeneratedAt: now.toISOString(), now });

const validAssessment = evaluate([0.005, 0.004]);
assert.equal(validAssessment.assessments.length, 3, "a valid nowcast should return all three horizons");
assert.equal(validAssessment.assessments[0].category, "urgent", "a close downwind fire should rank urgent");
assert.ok(evaluate([0.005, 0.03]).assessments[0].score < evaluate([0.005, 0.004]).assessments[0].score, "an upwind fire should score lower");
assert.ok(evaluate([-0.03, 0.015]).assessments[2].score < evaluate([0.005, 0.004]).assessments[2].score, "a crosswind fire should score lower");
assert.equal(calculateRiskNowcast({ features: [fire([0.005, 0.004])], perimeterGeometry, weatherByHorizon, snapshotGeneratedAt: "2026-07-27T08:00:00Z", now }).reason, "stale_snapshot");
assert.equal(calculateRiskNowcast({ features: [fire([0.005, 0.004])], perimeterGeometry, weatherByHorizon, snapshotGeneratedAt: now.toISOString(), now: new Date("2026-07-27T20:00:00Z") }).reason, "stale_snapshot");
assert.equal(calculateRiskNowcast({ features: [{ ...fire([0.005, 0.004]), properties: { detected_at: "2026-07-27T05:00:00Z" } }], perimeterGeometry, weatherByHorizon, snapshotGeneratedAt: now.toISOString(), now }).reason, "no_recent_detections");
assert.equal(calculateRiskNowcast({ features: [fire([0.005, 0.004])], perimeterGeometry, weatherByHorizon: { 1: weatherByHorizon[1], 3: weatherByHorizon[3] }, snapshotGeneratedAt: now.toISOString(), now }).reason, "weather_incomplete");
assert.ok(destinationPoint([0, 0], 90, 1)[0] > 0, "a 90 degree bearing should move east");
console.log("risk-model tests passed");
