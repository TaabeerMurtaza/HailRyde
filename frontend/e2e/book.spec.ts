import { expect, test } from '@playwright/test'

const api = 'http://localhost:8000'

test('books an economy ride from Gulberg to the airport', async ({ page, request }) => {
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

  await page.goto('/login')
  await page.getByLabel('Email').fill('rider@hailryde.test')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'Book a ride' })).toBeVisible()
  await page.getByLabel('Pickup').selectOption({ label: 'Gulberg' })
  await page.getByLabel('Destination').selectOption({ label: 'Allama Iqbal Airport' })
  await page.getByRole('radio', { name: 'Economy' }).check()

  await expect(page.getByText('391.70')).toBeVisible()
  await page.getByRole('button', { name: 'Request ride' }).click()

  await expect(page).toHaveURL(/\/rides\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Ride status' })).toBeVisible()
  await expect(page.getByText('391.70')).toBeVisible()
  await expect(page.getByText('PKR')).toBeVisible()
})
