/** Lightweight city → lat/lng lookup for company location maps (no network). */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const CITY_COORDS: Record<string, GeoPoint> = {
  "new york city": { lat: 40.71, lng: -74.01 },
  "new york": { lat: 40.71, lng: -74.01 },
  nyc: { lat: 40.71, lng: -74.01 },
  brooklyn: { lat: 40.68, lng: -73.94 },
  manhattan: { lat: 40.78, lng: -73.97 },
  "los angeles": { lat: 34.05, lng: -118.24 },
  "san francisco": { lat: 37.77, lng: -122.42 },
  "san jose": { lat: 37.34, lng: -121.89 },
  "palo alto": { lat: 37.44, lng: -122.14 },
  seattle: { lat: 47.61, lng: -122.33 },
  chicago: { lat: 41.88, lng: -87.63 },
  austin: { lat: 30.27, lng: -97.74 },
  "carrollton": { lat: 32.95, lng: -96.89 },
  dallas: { lat: 32.78, lng: -96.8 },
  houston: { lat: 29.76, lng: -95.37 },
  boston: { lat: 42.36, lng: -71.06 },
  cambridge: { lat: 42.37, lng: -71.11 },
  somerville: { lat: 42.39, lng: -71.1 },
  weston: { lat: 42.37, lng: -71.3 },
  milton: { lat: 42.25, lng: -71.07 },
  "red bank": { lat: 40.35, lng: -74.06 },
  raleigh: { lat: 35.78, lng: -78.64 },
  cornelius: { lat: 35.48, lng: -80.86 },
  pittsburgh: { lat: 40.44, lng: -79.99 },
  detroit: { lat: 42.33, lng: -83.05 },
  miami: { lat: 25.76, lng: -80.19 },
  atlanta: { lat: 33.75, lng: -84.39 },
  denver: { lat: 39.74, lng: -104.99 },
  philadelphia: { lat: 39.95, lng: -75.17 },
  washington: { lat: 38.91, lng: -77.04 },
  "washington dc": { lat: 38.91, lng: -77.04 },
  portland: { lat: 45.52, lng: -122.68 },
  toronto: { lat: 43.65, lng: -79.38 },
  vancouver: { lat: 49.28, lng: -123.12 },
  montreal: { lat: 45.5, lng: -73.57 },
  london: { lat: 51.51, lng: -0.13 },
  paris: { lat: 48.86, lng: 2.35 },
  berlin: { lat: 52.52, lng: 13.4 },
  amsterdam: { lat: 52.37, lng: 4.9 },
  sydney: { lat: -33.87, lng: 151.21 },
  melbourne: { lat: -37.81, lng: 144.96 },
  brisbane: { lat: -27.47, lng: 153.03 },
  singapore: { lat: 1.35, lng: 103.82 },
  tokyo: { lat: 35.68, lng: 139.69 },
  "hong kong": { lat: 22.32, lng: 114.17 },
  bangalore: { lat: 12.97, lng: 77.59 },
  bengaluru: { lat: 12.97, lng: 77.59 },
  mumbai: { lat: 19.08, lng: 72.88 },
  delhi: { lat: 28.61, lng: 77.21 },
  "united states": { lat: 39.5, lng: -98.35 },
  usa: { lat: 39.5, lng: -98.35 },
  "united kingdom": { lat: 54.0, lng: -2.5 },
  canada: { lat: 56.1, lng: -106.3 },
  australia: { lat: -25.3, lng: 133.8 },
};

const STATE_COORDS: Record<string, GeoPoint> = {
  alabama: { lat: 32.8, lng: -86.9 },
  alaska: { lat: 64.2, lng: -149.5 },
  arizona: { lat: 34.0, lng: -111.1 },
  arkansas: { lat: 34.8, lng: -92.2 },
  california: { lat: 36.8, lng: -119.4 },
  colorado: { lat: 39.1, lng: -105.4 },
  connecticut: { lat: 41.6, lng: -72.7 },
  delaware: { lat: 39.0, lng: -75.5 },
  florida: { lat: 27.8, lng: -81.7 },
  georgia: { lat: 32.2, lng: -83.5 },
  hawaii: { lat: 19.9, lng: -155.6 },
  idaho: { lat: 44.1, lng: -114.7 },
  illinois: { lat: 40.3, lng: -89.0 },
  indiana: { lat: 39.8, lng: -86.1 },
  iowa: { lat: 42.0, lng: -93.2 },
  kansas: { lat: 38.5, lng: -98.3 },
  kentucky: { lat: 37.5, lng: -85.3 },
  louisiana: { lat: 31.2, lng: -91.9 },
  maine: { lat: 45.3, lng: -69.2 },
  maryland: { lat: 39.0, lng: -76.6 },
  massachusetts: { lat: 42.2, lng: -71.5 },
  michigan: { lat: 43.3, lng: -84.5 },
  minnesota: { lat: 46.0, lng: -94.6 },
  mississippi: { lat: 32.7, lng: -89.7 },
  missouri: { lat: 38.4, lng: -92.5 },
  montana: { lat: 46.9, lng: -110.4 },
  nebraska: { lat: 41.5, lng: -99.8 },
  nevada: { lat: 38.8, lng: -116.4 },
  "new hampshire": { lat: 43.7, lng: -71.6 },
  "new jersey": { lat: 40.1, lng: -74.5 },
  "new mexico": { lat: 34.5, lng: -106.0 },
  "new york": { lat: 42.9, lng: -75.5 },
  "north carolina": { lat: 35.6, lng: -79.8 },
  "north dakota": { lat: 47.5, lng: -100.5 },
  ohio: { lat: 40.4, lng: -82.8 },
  oklahoma: { lat: 35.6, lng: -97.5 },
  oregon: { lat: 44.0, lng: -120.5 },
  pennsylvania: { lat: 40.9, lng: -77.2 },
  "rhode island": { lat: 41.7, lng: -71.5 },
  "south carolina": { lat: 33.9, lng: -80.9 },
  "south dakota": { lat: 44.4, lng: -100.2 },
  tennessee: { lat: 35.7, lng: -86.0 },
  texas: { lat: 31.5, lng: -99.3 },
  utah: { lat: 39.3, lng: -111.7 },
  vermont: { lat: 44.0, lng: -72.7 },
  virginia: { lat: 37.5, lng: -78.7 },
  washington: { lat: 47.4, lng: -120.5 },
  "west virginia": { lat: 38.6, lng: -80.6 },
  wisconsin: { lat: 44.3, lng: -89.6 },
  wyoming: { lat: 43.0, lng: -107.6 },
  "new south wales": { lat: -32.0, lng: 147.0 },
  queensland: { lat: -22.0, lng: 145.0 },
  victoria: { lat: -37.0, lng: 144.5 },
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupLocationCoords(label: string): GeoPoint | null {
  const clean = normalize(label);
  if (!clean) return null;

  if (CITY_COORDS[clean]) return CITY_COORDS[clean];

  const cityPart = normalize(clean.split(",")[0] ?? "");
  if (CITY_COORDS[cityPart]) return CITY_COORDS[cityPart];

  const regionPart = normalize(clean.split(",")[1] ?? "");
  if (regionPart && STATE_COORDS[regionPart]) return STATE_COORDS[regionPart];

  for (const [key, point] of Object.entries(CITY_COORDS)) {
    if (clean.includes(key) || cityPart.includes(key)) return point;
  }

  if (regionPart && STATE_COORDS[regionPart]) return STATE_COORDS[regionPart];
  return null;
}

/** Project lat/lng into a 1000×500 equirectangular canvas. */
export function projectEquirectangular(
  lat: number,
  lng: number,
  width = 1000,
  height = 500,
): { x: number; y: number } {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}
