import { useCallback, useEffect, useState } from 'react'
import { inServiceArea } from './service-area'

export type LatLng = { lat: number; lng: number }

const NOTE = 'Place the pickup pin on the map.'
const NETWORK: PositionOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }

type Reading = { fix: LatLng | null; denied: boolean }

function readPosition(options: PositionOptions): Promise<Reading> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ fix: null, denied: false })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          fix: { lat: position.coords.latitude, lng: position.coords.longitude },
          denied: false,
        })
      },
      (error) => resolve({ fix: null, denied: error.code === 1 }),
      options,
    )
  })
}

function inside(reading: Reading): LatLng | null {
  if (!reading.fix || !inServiceArea(reading.fix.lat, reading.fix.lng)) {
    return null
  }
  return reading.fix
}

async function locate(): Promise<LatLng | null> {
  const network = await readPosition(NETWORK)
  const networkFix = inside(network)
  if (networkFix || network.denied) {
    return networkFix
  }

  // A laptop often times out on a precise GPS fix and still has a network fix.
  // When the network fix is missing, ask once more with high accuracy.
  return inside(await readPosition(PRECISE))
}

export function useUserLocation(): {
  user: LatLng | null
  note: string | null
  locating: boolean
  refresh: () => Promise<LatLng | null>
} {
  const [user, setUser] = useState<LatLng | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  function apply(fix: LatLng | null) {
    if (fix) {
      setUser(fix)
      setNote(null)
    } else {
      setNote(NOTE)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLocating(true)

    void locate()
      .then((fix) => {
        if (!cancelled) {
          apply(fix)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLocating(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    setLocating(true)
    try {
      const fix = await locate()
      apply(fix)
      return fix
    } finally {
      setLocating(false)
    }
  }, [])

  return { user, note, locating, refresh }
}
