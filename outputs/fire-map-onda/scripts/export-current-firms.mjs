#!/usr/bin/env node

/**
 * Fetch the public active-fire payload used by earth.nullschool.net and export
 * the subset around the map's area of interest as GeoJSON.
 *
 * Usage: node scripts/export-current-firms.mjs
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://gaia.nullschool.net/data/firms/current/current-firms.epak";
const OUTPUT_PATH = new URL("../data/firms-current.geojson", import.meta.url);
const IMPORT_KML_PATH = new URL("../data/current-hotspots-nearby.kml", import.meta.url);
const PERIMETER_PATH = new URL("../data/zone-of-interest.kml", import.meta.url);
const PERIMETER_GEOJSON_PATH = new URL("../data/zone-of-interest.geojson", import.meta.url);
const PERIMETER_KML_URL = "https://www.google.com/maps/d/kml?mid=1tqpTAqEbdQr_F5Pq8YIQU8QlpNsNeXk&forcekml=1";
const LOCAL_EXTENT = { west: -0.42, south: 39.78, east: -0.08, north: 40.11 };

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[character]);
}

function parsePerimeterKml(kml) {
  const name = /<Placemark>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<Polygon>/i.exec(kml)?.[1]?.trim() ?? "Area of interest";
  const coordinateText = /<Polygon>[\s\S]*?<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/i.exec(kml)?.[1];
  if (!coordinateText) throw new Error("The My Maps KML has no polygon coordinates.");
  const coordinates = coordinateText.trim().split(/\s+/).map(item => {
    const [longitude, latitude] = item.split(",").map(Number);
    return [longitude, latitude];
  });
  if (coordinates.length < 4 || !coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))) {
    throw new Error("The My Maps perimeter coordinates are invalid.");
  }
  return { name: name.replace(/<[^>]+>/g, ""), coordinates };
}

function pointInPolygon([longitude, latitude], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];
    const crossesLatitude = (y1 > latitude) !== (y2 > latitude);
    if (crossesLatitude && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function createHotspotKml(features, perimeterName, generatedAt) {
  const placemarks = features.map(feature => {
    const [lon, lat] = feature.geometry.coordinates;
    const { detected_at: detectedAt, frp_mw: frp } = feature.properties;
    const zoneText = feature.properties.inside_area_of_interest ? "Inside the area of interest" : "Outside the area of interest";
    return `    <Placemark>\n      <name>${escapeXml(`Fire detection · ${frp.toFixed(2)} MW`)}</name>\n      <description><![CDATA[<p><strong>Detected:</strong> ${detectedAt}</p><p><strong>Fire Radiative Power:</strong> ${frp.toFixed(2)} MW</p><p><strong>Zone:</strong> ${zoneText} (${perimeterName})</p>]]></description>\n      <styleUrl>#hotspot</styleUrl>\n      <Point><coordinates>${lon},${lat},0</coordinates></Point>\n    </Placemark>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Current nearby active-fire hotspots — ${escapeXml(perimeterName)}</name>\n    <description>Generated ${generatedAt} from the Earth Nullschool current FIRMS feed. Points are detections, not a verified fire perimeter. Each point states whether it lies inside the My Maps area of interest.</description>\n    <Style id="hotspot"><IconStyle><color>ff3030ff</color><scale>1.15</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/firedept.png</href></Icon></IconStyle></Style>\n${placemarks}\n  </Document>\n</kml>\n`;
}

function decodeDelta(encoded, elementType, count, scale) {
  const values = elementType === 9 ? new Float64Array(count) : new Float32Array(count);
  let inputIndex = 0;
  let outputIndex = 0;

  while (inputIndex < encoded.length && outputIndex < values.length) {
    let value = encoded[inputIndex++];
    if (value < 128) {
      value = (value << 25) >> 25;
    } else {
      switch (value >> 4) {
        case 8:
        case 9:
        case 10:
        case 11:
          value = ((value << 26) >> 18) | encoded[inputIndex++];
          break;
        case 12:
        case 13:
          value = ((value << 27) >> 11) | (encoded[inputIndex++] << 8) | encoded[inputIndex++];
          break;
        case 14:
          value = ((value << 28) >> 4) | (encoded[inputIndex++] << 16) | (encoded[inputIndex++] << 8) | encoded[inputIndex++];
          break;
        case 15:
          if (value === 255) {
            for (let remaining = 1 + encoded[inputIndex++]; remaining > 0; remaining--) {
              values[outputIndex++] = Number.NaN;
            }
            continue;
          }
          value = (encoded[inputIndex++] << 24) | (encoded[inputIndex++] << 16) |
            (encoded[inputIndex++] << 8) | encoded[inputIndex++];
          break;
        default:
          throw new Error(`Unsupported packed integer prefix: ${value}`);
      }
    }
    values[outputIndex++] = value;
  }

  for (let i = 1; i < values.length; i++) values[i] += values[i - 1];
  for (let i = 0; i < values.length; i++) values[i] /= scale;
  return values;
}

function parseEpak(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  let offset = 0;
  const readTag = () => {
    const tag = decoder.decode(bytes.subarray(offset, offset + 4));
    offset += 4;
    return tag;
  };

  if (readTag() !== "head") throw new Error("Unexpected Earth Nullschool data format.");
  const headerLength = view.getInt32(offset);
  offset += 4;
  const header = JSON.parse(decoder.decode(bytes.subarray(offset, offset + headerLength)));
  offset += headerLength;

  const blocks = [];
  while (offset < bytes.length) {
    const type = readTag();
    if (type === "tail") break;
    const length = view.getInt32(offset);
    offset += 4;
    if (type !== "qpak") throw new Error(`Unsupported Earth Nullschool block: ${type}`);

    const elementType = view.getUint8(offset);
    const count = view.getInt32(offset + 1);
    const scale = view.getFloat64(offset + 5);
    blocks.push(decodeDelta(bytes.subarray(offset + 13, offset + length), elementType, count, scale));
    offset += length;
  }
  return { header, blocks };
}

const fireResponse = await fetch(SOURCE_URL);
if (!fireResponse.ok) throw new Error(`Fire data download failed: ${fireResponse.status} ${fireResponse.statusText}`);

// The forest boundary is intentionally fixed. This local KML is the canonical
// perimeter used for every snapshot, even if the shared My Maps layer changes.
const perimeterKml = await readFile(PERIMETER_PATH, "utf8");
const perimeter = parsePerimeterKml(perimeterKml);
const { header, blocks } = parseEpak(await fireResponse.arrayBuffer());
const [timestamp, longitude, latitude, frp] = blocks;
if (![timestamp, longitude, latitude, frp].every(Boolean)) throw new Error("Fire payload is missing required columns.");

const features = [];
for (let i = 0; i < timestamp.length; i++) {
  const lon = longitude[i];
  const lat = latitude[i];
  const isNearby = Number.isFinite(lon) && Number.isFinite(lat) && lon >= LOCAL_EXTENT.west && lon <= LOCAL_EXTENT.east && lat >= LOCAL_EXTENT.south && lat <= LOCAL_EXTENT.north;
  if (!isNearby) continue;
  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      detected_at: new Date(timestamp[i]).toISOString(),
      frp_mw: Number(frp[i].toFixed(2)),
      inside_area_of_interest: pointInPolygon([lon, lat], perimeter.coordinates),
    },
  });
}

const generatedAt = new Date().toISOString();
const detectionsInsideArea = features.filter(feature => feature.properties.inside_area_of_interest).length;
const featureCollection = {
  type: "FeatureCollection",
  generated_at: generatedAt,
  source_url: SOURCE_URL,
  source: "VIIRS NRT active fire data via FIRMS / NASA, supplied by Earth Nullschool",
  area_of_interest: {
    name: perimeter.name,
    source_url: PERIMETER_KML_URL,
    geometry: { type: "Polygon", coordinates: [perimeter.coordinates] },
  },
  local_extent: LOCAL_EXTENT,
  detections_inside_area_of_interest: detectionsInsideArea,
  features,
};

const perimeterGeojson = {
  type: "FeatureCollection",
  source_url: PERIMETER_KML_URL,
  features: [{
    type: "Feature",
    properties: { name: perimeter.name },
    geometry: { type: "Polygon", coordinates: [perimeter.coordinates] },
  }],
};

async function writeAtomically(targetUrl, contents) {
  const targetPath = fileURLToPath(targetUrl);
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents);
  await rename(temporaryPath, targetPath);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeAtomically(OUTPUT_PATH, `${JSON.stringify(featureCollection)}\n`);
await writeAtomically(IMPORT_KML_PATH, createHotspotKml(features, perimeter.name, generatedAt));
await writeAtomically(PERIMETER_GEOJSON_PATH, `${JSON.stringify(perimeterGeojson)}\n`);
console.log(`Wrote ${features.length} nearby active-fire detections (${detectionsInsideArea} inside '${perimeter.name}') to ${IMPORT_KML_PATH.pathname}`);
