// Fixed local coverage around El Saler. Keeping this extent static preserves
// the wind layer's independence from FIRMS.
const GRID_LATITUDE_OFFSETS = [-0.04, -0.02, 0, 0.02, 0.04];
const GRID_LONGITUDE_OFFSETS = [-0.04, -0.02, 0, 0.02, 0.04];

export function createWindGrid([latitude, longitude]) {
  return GRID_LATITUDE_OFFSETS.flatMap(latitudeOffset =>
    GRID_LONGITUDE_OFFSETS.map(longitudeOffset => ({
      latitude: latitude + latitudeOffset,
      longitude: longitude + longitudeOffset,
    })),
  );
}

export function windTravelBearing(windFromDegrees) {
  return (windFromDegrees + 180) % 360;
}

function parseUtcTime(value) {
  if (typeof value !== "string") return new Date(Number.NaN);
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

export function parseCurrentWindPayload(payload, requestedLocations) {
  const responses = Array.isArray(payload) ? payload : [payload];
  if (responses.length !== requestedLocations.length) {
    throw new Error(`Expected ${requestedLocations.length} wind locations, received ${responses.length}.`);
  }

  return responses.map((response, index) => {
    const current = response?.current;
    const observation = {
      ...requestedLocations[index],
      windSpeedKmh: Number(current?.wind_speed_10m),
      windDirection: Number(current?.wind_direction_10m),
      windGustKmh: Number(current?.wind_gusts_10m),
      observedAt: parseUtcTime(current?.time),
    };
    if (![observation.windSpeedKmh, observation.windDirection, observation.windGustKmh, observation.observedAt.getTime()].every(Number.isFinite)) {
      throw new Error(`Current wind data is incomplete for location ${index + 1}.`);
    }
    return observation;
  });
}
