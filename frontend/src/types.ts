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
