import type { LineString } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import { SERVICE_AREA, SOAN_GARDENS } from '../service-area'
import type { DriverDot } from '../types'

maplibregl.setWorkerUrl(workerUrl)

type LatLng = { lat: number; lng: number }

type Props = {
  pickup: LatLng | null
  destination: LatLng | null
  user: LatLng | null
  drivers: DriverDot[]
  route: LineString | null
  focus: LatLng | null
  fit: boolean
  interactive: boolean
  onPickup: (lat: number, lng: number) => void
  onDestination: (lat: number, lng: number) => void
}

const EMPTY_ROUTE: LineString = { type: 'LineString', coordinates: [] }

function dot(color: string, size: number): HTMLElement {
  const element = document.createElement('div')
  element.dataset.pin = ''
  element.style.pointerEvents = 'none'
  element.style.width = `${size}px`
  element.style.height = `${size}px`
  element.style.borderRadius = '9999px'
  element.style.background = color
  element.style.border = '2px solid #ffffff'
  return element
}

export function RideMap({
  pickup,
  destination,
  user,
  drivers,
  route,
  focus,
  fit,
  interactive,
  onPickup,
  onDestination,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const pickupRef = useRef(pickup)
  const routeRef = useRef(route)
  const onPickupRef = useRef(onPickup)
  const onDestinationRef = useRef(onDestination)
  const userMarker = useRef<maplibregl.Marker | null>(null)
  const driverMarkers = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    pickupRef.current = pickup
    routeRef.current = route
    onPickupRef.current = onPickup
    onDestinationRef.current = onDestination
  })

  useEffect(() => {
    if (!container.current) {
      return
    }

    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [SOAN_GARDENS.lng, SOAN_GARDENS.lat],
      zoom: 12,
      maxBounds: [
        [SERVICE_AREA.west, SERVICE_AREA.south],
        [SERVICE_AREA.east, SERVICE_AREA.north],
      ],
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: routeRef.current ?? EMPTY_ROUTE },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#d97706', 'line-width': 5 },
      })
    })

    return () => {
      userMarker.current = null
      driverMarkers.current = []
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const source = mapRef.current?.getSource('route') as maplibregl.GeoJSONSource | undefined
    source?.setData({ type: 'Feature', properties: {}, geometry: route ?? EMPTY_ROUTE })
  }, [route])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !interactive) {
      return
    }

    const handler = (event: maplibregl.MapMouseEvent) => {
      const target = event.originalEvent?.target
      if (target instanceof Element && target.closest('[data-pin]')) {
        return
      }
      const { lat, lng } = event.lngLat
      if (pickupRef.current === null) {
        onPickupRef.current(lat, lng)
      } else {
        onDestinationRef.current(lat, lng)
      }
    }
    map.on('click', handler)

    return () => {
      map.off('click', handler)
    }
  }, [interactive])

  useEffect(
    () => pin(mapRef.current, pickup, '#d97706', interactive, (lat, lng) => onPickupRef.current(lat, lng)),
    [pickup, interactive],
  )

  useEffect(
    () => pin(mapRef.current, destination, '#1c1917', interactive, (lat, lng) => onDestinationRef.current(lat, lng)),
    [destination, interactive],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    if (fit) {
      const points: [number, number][] = []
      if (pickup) {
        points.push([pickup.lng, pickup.lat])
      }
      if (destination) {
        points.push([destination.lng, destination.lat])
      }
      for (const pair of route?.coordinates ?? []) {
        if (pair.length >= 2) {
          points.push([pair[0], pair[1]])
        }
      }
      if (points.length === 1) {
        map.easeTo({ center: points[0] })
      } else if (points.length > 1) {
        let west = points[0][0]
        let east = points[0][0]
        let south = points[0][1]
        let north = points[0][1]
        for (const [lng, lat] of points) {
          west = Math.min(west, lng)
          east = Math.max(east, lng)
          south = Math.min(south, lat)
          north = Math.max(north, lat)
        }
        map.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: 48, maxZoom: 14 },
        )
      }
      return
    }
    if (focus) {
      map.easeTo({ center: [focus.lng, focus.lat] })
    }
  }, [destination, fit, focus, pickup, route])

  useEffect(() => {
    const map = mapRef.current
    userMarker.current?.remove()
    userMarker.current = null
    if (map && user) {
      userMarker.current = new maplibregl.Marker({ element: dot('#0284c7', 16) })
        .setLngLat([user.lng, user.lat])
        .addTo(map)
    }
  }, [user])

  useEffect(() => {
    const map = mapRef.current
    driverMarkers.current.forEach((marker) => marker.remove())
    driverMarkers.current = []
    if (map) {
      driverMarkers.current = drivers.map((driver) =>
        new maplibregl.Marker({ element: dot('#78716c', 10) })
          .setLngLat([Number(driver.lng), Number(driver.lat)])
          .addTo(map),
      )
    }
  }, [drivers])

  return <div role="region" aria-label="Trip map" ref={container} className="h-96 w-full" />
}

function pin(
  map: maplibregl.Map | null,
  at: LatLng | null,
  color: string,
  interactive: boolean,
  onMove: (lat: number, lng: number) => void,
): (() => void) | undefined {
  if (!map || !at) {
    return undefined
  }

  const marker = new maplibregl.Marker({ color, draggable: interactive }).setLngLat([at.lng, at.lat]).addTo(map)
  marker.getElement().dataset.pin = ''
  if (interactive) {
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      onMove(lat, lng)
    })
  }

  return () => {
    marker.remove()
  }
}
