import { useCallback, useEffect, useState } from 'react'
import { inLahore } from './lahore'

export type LatLng = { lat: number; lng: number }

const NOTE = 'Place the pickup pin on the map.'
const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }

function locate(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fix = { lat: position.coords.latitude, lng: position.coords.longitude }
        resolve(inLahore(fix.lat, fix.lng) ? fix : null)
      },
      () => resolve(null),
      OPTIONS,
    )
  })
}

export function useUserLocation(): {
  user: LatLng | null
  note: string | null
  refresh: () => Promise<LatLng | null>
} {
  const [user, setUser] = useState<LatLng | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void locate().then((fix) => {
      if (cancelled) {
        return
      }
      if (fix) {
        setUser(fix)
        setNote(null)
      } else {
        setNote(NOTE)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    const fix = await locate()
    if (fix) {
      setUser(fix)
      setNote(null)
    } else {
      setNote(NOTE)
    }
    return fix
  }, [])

  return { user, note, refresh }
}
