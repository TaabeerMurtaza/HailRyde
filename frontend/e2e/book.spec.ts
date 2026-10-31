import { expect, test } from '@playwright/test'

const api = 'http://localhost:8000'

test('books an economy ride from Gulberg by clicking the map', async ({ page, request }) => {
  const login = await request.post(`${api}/api/login`, {
    data: { email: 'rider@hailryde.test', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const { token } = (await login.json()) as { token: string }

  const listed = await request.get(`${api}/api/rides`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(listed.ok()).toBeTruthy()
  const { rides } = (await listed.json()) as { rides: { id: number; status: string }[] }

  for (const ride of rides) {
    if (ride.status === 'requested' || ride.status === 'accepted') {
      const cancelled = await request.post(`${api}/api/rides/${ride.id}/cancel`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(cancelled.ok()).toBeTruthy()
    }
  }

  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 31.5204, longitude: 74.3587 })

  await page.goto('/login')
  await page.getByLabel('Email').fill('rider@hailryde.test')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'Book a ride' })).toBeVisible()
  await expect(page.getByText('Pickup 31.520400, 74.358700')).toBeVisible()
  const map = page.getByRole('region', { name: 'Trip map' })
  const box = await map.boundingBox()
  if (!box) throw new Error('Trip map has no box')
  await map.click({ position: { x: box.width * 0.72, y: box.height * 0.38 } })

  await expect(page.getByText(/^Destination \d+\.\d{6}, \d+\.\d{6}$/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Economy' })).toBeChecked()
  const fare = page.getByTestId('quote-fare')
  await expect(fare).toHaveText(/^\d+\.\d{2}$/, { timeout: 20_000 })
  const amount = (await fare.textContent()) ?? ''

  await page.getByRole('button', { name: 'Request ride' }).click()

  await expect(page).toHaveURL(/\/rides\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Ride status' })).toBeVisible()
  await expect(page.getByTestId('ride-fare')).toHaveText(amount)
  await expect(page.getByText('PKR')).toBeVisible()
})
