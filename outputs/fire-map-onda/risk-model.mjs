export const RISK_HORIZONS = [
  { hours: 1, reachKm: 1 },
  { hours: 3, reachKm: 3 },
  { hours: 6, reachKm: 6 },
];

export const MAX_SNAPSHOT_AGE_HOURS = 2;
export const MAX_DETECTION_AGE_HOURS = 6;

const EARTH_RADIUS_KM = 6371;
const clamp = (value, minimum = 0, maximum = 1) => Math.min(Math.max(value, minimum), maximum);
const radians = degrees => degrees * Math.PI / 180;
const degrees = radiansValue => radiansValue * 180 / Math.PI;

function angularDifference(first, second) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

export function bearingDegrees(from, to) {
  const longitudeDifference = radians(to[0] - from[0]);
  const fromLatitude = radians(from[1]);
  const toLatitude = radians(to[1]);
  const y = Math.sin(longitudeDifference) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude) - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDifference);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint([longitude, latitude], bearing, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const startLatitude = radians(latitude);
  const startLongitude = radians(longitude);
  const bearingRadians = radians(bearing);
  const endLatitude = Math.asin(Math.sin(startLatitude) * Math.cos(angularDistance) + Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearingRadians));
  const endLongitude = startLongitude + Math.atan2(Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(startLatitude), Math.cos(angularDistance) - Math.sin(startLatitude) * Math.sin(endLatitude));
  return [(degrees(endLongitude) + 540) % 360 - 180, degrees(endLatitude)];
}

function polygonRings(geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

export function nearestBoundaryPoint(point, perimeterGeometry) {
  const rings = polygonRings(perimeterGeometry);
  let nearest;
  const latitudeScale = 110.574;
  const longitudeScale = 111.32 * Math.cos(radians(point[1]));

  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index++) {
      const start = ring[index];
      const end = ring[index + 1];
      const startX = (start[0] - point[0]) * longitudeScale;
      const startY = (start[1] - point[1]) * latitudeScale;
      const endX = (end[0] - point[0]) * longitudeScale;
      const endY = (end[1] - point[1]) * latitudeScale;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const segmentLengthSquared = deltaX ** 2 + deltaY ** 2;
      const fraction = segmentLengthSquared ? clamp(((-startX * deltaX) + (-startY * deltaY)) / segmentLengthSquared) : 0;
      const pointX = startX + fraction * deltaX;
      const pointY = startY + fraction * deltaY;
      const distanceKm = Math.hypot(pointX, pointY);
      if (!nearest || distanceKm < nearest.distanceKm) {
        nearest = {
          distanceKm,
          point: [point[0] + pointX / longitudeScale, point[1] + pointY / latitudeScale],
        };
      }
    }
  }
  return nearest;
}

export function summarizeForecast(entries, now, hours) {
  const endTime = now.getTime() + hours * 60 * 60 * 1000;
  const windowEntries = entries.filter(entry => entry.time.getTime() >= now.getTime() - 15 * 60 * 1000 && entry.time.getTime() <= endTime);
  if (!windowEntries.length) return undefined;
  if (windowEntries.some(entry => ![entry.windSpeedKmh, entry.windDirection, entry.windGustKmh, entry.relativeHumidity, entry.precipitationMm, entry.soilMoisture].every(Number.isFinite))) return undefined;

  const strongestWind = windowEntries.reduce((strongest, entry) => entry.windGustKmh > strongest.windGustKmh ? entry : strongest);
  return {
    windSpeedKmh: Math.max(...windowEntries.map(entry => entry.windSpeedKmh)),
    windGustKmh: strongestWind.windGustKmh,
    windDirection: strongestWind.windDirection,
    relativeHumidity: Math.min(...windowEntries.map(entry => entry.relativeHumidity)),
    precipitationMm: windowEntries.reduce((total, entry) => total + entry.precipitationMm, 0),
    soilMoisture: Math.min(...windowEntries.map(entry => entry.soilMoisture)),
  };
}

function windScore(weather) {
  const strongestWind = Math.max(weather.windSpeedKmh, weather.windGustKmh);
  if (strongestWind >= 40) return 1;
  if (strongestWind >= 25) return 0.75;
  if (strongestWind >= 15) return 0.45;
  return 0.2;
}

function drynessScore(weather) {
  const humidityScore = weather.relativeHumidity <= 20 ? 1 : weather.relativeHumidity <= 35 ? 0.75 : weather.relativeHumidity <= 50 ? 0.45 : 0.2;
  const soilScore = weather.soilMoisture <= 0.1 ? 1 : weather.soilMoisture <= 0.2 ? 0.65 : 0.35;
  const rainReduction = weather.precipitationMm >= 1 ? 0.3 : weather.precipitationMm > 0 ? 0.1 : 0;
  return clamp(humidityScore * 0.8 + soilScore * 0.2 - rainReduction);
}

function freshnessScore(ageHours) {
  if (ageHours <= 2) return 1;
  if (ageHours <= 4) return 0.75;
  return 0.4;
}

function alignmentScore(alignmentDegrees) {
  if (alignmentDegrees <= 25) return 1;
  if (alignmentDegrees <= 50) return 0.75;
  if (alignmentDegrees <= 75) return 0.35;
  return 0;
}

export function riskCategory(score) {
  if (score >= 0.7) return "urgent";
  if (score >= 0.5) return "elevated";
  if (score >= 0.28) return "watch";
  return "low";
}

function scoreCandidate(feature, perimeterGeometry, weather, horizon, now) {
  const firePoint = feature.geometry.coordinates;
  const boundary = nearestBoundaryPoint(firePoint, perimeterGeometry);
  if (!boundary) return undefined;
  const detectedAt = new Date(feature.properties.detected_at);
  const ageHours = Math.max(0, (now.getTime() - detectedAt.getTime()) / 3_600_000);
  const bearingToForest = bearingDegrees(firePoint, boundary.point);
  const downwindBearing = (weather.windDirection + 180) % 360;
  const alignmentDegrees = angularDifference(bearingToForest, downwindBearing);
  const components = {
    distance: clamp(1 - boundary.distanceKm / horizon.reachKm),
    alignment: alignmentScore(alignmentDegrees),
    wind: windScore(weather),
    dryness: drynessScore(weather),
    freshness: freshnessScore(ageHours),
  };
  const score = components.distance * 0.4 + components.alignment * 0.3 + components.wind * 0.15 + components.dryness * 0.1 + components.freshness * 0.05;
  return {
    feature,
    horizon,
    weather,
    score,
    category: riskCategory(score),
    components,
    distanceKm: boundary.distanceKm,
    nearestForestPoint: boundary.point,
    bearingToForest,
    downwindBearing,
    alignmentDegrees,
    ageHours,
  };
}

export function calculateRiskNowcast({ features, perimeterGeometry, weatherByHorizon, snapshotGeneratedAt, now = new Date() }) {
  const snapshotTime = new Date(snapshotGeneratedAt);
  if (!Number.isFinite(snapshotTime.getTime()) || now.getTime() - snapshotTime.getTime() > MAX_SNAPSHOT_AGE_HOURS * 3_600_000) {
    return { status: "unavailable", reason: "stale_snapshot" };
  }
  const eligibleFeatures = features.filter(feature => {
    const detectedAt = new Date(feature.properties.detected_at);
    return Number.isFinite(detectedAt.getTime()) && now.getTime() - detectedAt.getTime() <= MAX_DETECTION_AGE_HOURS * 3_600_000;
  });
  if (!eligibleFeatures.length) return { status: "unavailable", reason: "no_recent_detections" };

  const assessments = [];
  for (const horizon of RISK_HORIZONS) {
    const weather = weatherByHorizon[horizon.hours];
    if (!weather) return { status: "unavailable", reason: "weather_incomplete" };
    const candidates = eligibleFeatures.map(feature => scoreCandidate(feature, perimeterGeometry, weather, horizon, now)).filter(Boolean);
    assessments.push(candidates.sort((first, second) => second.score - first.score)[0]);
  }
  return { status: "ready", assessments };
}
