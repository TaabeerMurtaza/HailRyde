import type { LineString } from 'geojson'

export type Role = 'rider' | 'driver'

export type DriverProfile = {
  plate: string
  category: 'economy' | 'comfort'
  status: 'available' | 'on_trip' | 'offline'
  lat: string
  lng: string
}

export type AuthUser = {
  id: number
  name: string
  email: string
  phone: string
  role: Role
  driver_profile: DriverProfile | null
}

export type ApiError = {
  code: string
  message: string
  details: Record<string, string[]>
}

export type SessionResponse = {
  token: string
  user: AuthUser
}

export type Place = {
  id: string
  name: string
  lat: string
  lng: string
}

export type RideCategory = 'economy' | 'comfort'

export type Estimate = {
  distance_km: string
  duration_min: number
  fare_amount: string
  currency: string
  pickup_eta_min: number | null
  route: LineString | null
}

export type RideStatus = 'requested' | 'accepted' | 'completed' | 'cancelled'

export type RidePerson = {
  id: number
  name: string
  phone: string
}

export type RideDriver = RidePerson & {
  plate: string
  category: RideCategory
  lat: string
  lng: string
}

export type DriverDot = {
  id: number
  lat: string
  lng: string
  category: RideCategory
}

export type Ride = {
  id: number
  status: RideStatus
  category: RideCategory
  pickup: Place
  destination: Place
  route: LineString | null
  distance_km: string
  duration_min: number
  pickup_eta_min: number | null
  fare_amount: string
  currency: string
  rider: RidePerson
  driver: RideDriver | null
  accepted_at: string | null
  cancelled_at: string | null
  completed_at: string | null
}
