export const LAHORE = { south: 31.3, north: 31.7, west: 74.1, east: 74.55 }
export const GULBERG = { lat: 31.5204, lng: 74.3587 }

export function inLahore(lat: number, lng: number): boolean {
  return lat >= LAHORE.south && lat <= LAHORE.north && lng >= LAHORE.west && lng <= LAHORE.east
}

export function format6(value: number): string {
  return (Math.round(value * 1e6) / 1e6).toFixed(6)
}
