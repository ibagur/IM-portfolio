#!/usr/bin/env node

/**
 * Fetch the public active-fire payload used by earth.nullschool.net and export
 * the subset around the map's area of interest as GeoJSON.
 *
 * Usage: node scripts/export-current-firms.mjs
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { HOTSPOT_MONITORING_EXTENT, MAP_REFERENCE_COORDS } from "../monitoring-area.mjs";

const SOURCE_URL = "https://gaia.nullschool.net/data/firms/current/current-firms.epak";
const OUTPUT_PATH = new URL("../data/firms-current.geojson", import.meta.url);
const IMPORT_KML_PATH = new URL("../data/current-hotspots-nearby.kml", import.meta.url);
const LOCAL_EXTENT = HOTSPOT_MONITORING_EXTENT;
const MAP_NAME = "Foco de incendios el Saler";

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[character]);
}

function createHotspotKml(features, generatedAt) {
  const placemarks = features.map(feature => {
    const [lon, lat] = feature.geometry.coordinates;
    const { detected_at: detectedAt, frp_mw: frp } = feature.properties;
    return `    <Placemark>\n      <name>${escapeXml(`Fire detection · ${frp.toFixed(2)} MW`)}</name>\n      <description><![CDATA[<p><strong>Detected:</strong> ${detectedAt}</p><p><strong>Fire Radiative Power:</strong> ${frp.toFixed(2)} MW</p><p>VIIRS active-fire detection near El Saler; this point is not a verified fire perimeter.</p>]]></description>\n      <styleUrl>#hotspot</styleUrl>\n      <Point><coordinates>${lon},${lat},0</coordinates></Point>\n    </Placemark>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${escapeXml(MAP_NAME)} — current active-fire detections</name>\n    <description>Generated ${generatedAt} from the Earth Nullschool current FIRMS feed. Points are VIIRS detections near El Saler, not a verified fire perimeter.</description>\n    <Style id="hotspot"><IconStyle><color>ff3030ff</color><scale>1.15</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/firedept.png</href></Icon></IconStyle></Style>\n${placemarks}\n  </Document>\n</kml>\n`;
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
    },
  });
}

const generatedAt = new Date().toISOString();
const featureCollection = {
  type: "FeatureCollection",
  generated_at: generatedAt,
  source_url: SOURCE_URL,
  source: "VIIRS NRT active fire data via FIRMS / NASA, supplied by Earth Nullschool",
  reference_location: {
    name: "El Saler, Valencia",
    coordinates: [MAP_REFERENCE_COORDS[1], MAP_REFERENCE_COORDS[0]],
  },
  local_extent: LOCAL_EXTENT,
  features,
};

async function writeAtomically(targetUrl, contents) {
  const targetPath = fileURLToPath(targetUrl);
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents);
  await rename(temporaryPath, targetPath);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeAtomically(OUTPUT_PATH, `${JSON.stringify(featureCollection)}\n`);
await writeAtomically(IMPORT_KML_PATH, createHotspotKml(features, generatedAt));
console.log(`Wrote ${features.length} active-fire detections near El Saler to ${IMPORT_KML_PATH.pathname}`);
