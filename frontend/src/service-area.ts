export const SERVICE_AREA = { south: 33.49, north: 33.63, west: 73.07, east: 73.23 }
export const SOAN_GARDENS = { lat: 33.561778, lng: 73.148275 }

export function inServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= SERVICE_AREA.south &&
    lat <= SERVICE_AREA.north &&
    lng >= SERVICE_AREA.west &&
    lng <= SERVICE_AREA.east
  )
}

export function format6(value: number): string {
  return (Math.round(value * 1e6) / 1e6).toFixed(6)
}
