import { test, expect } from '@playwright/test';

test.describe('Customer App - Ride Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4000'); // customer-app
  });

  test('should complete full booking flow', async ({ page }) => {
    // Login
    await page.click('text=Login');
    await page.fill('input[name="email"]', 'customer@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*book/);
    
    // Book a ride
    await page.fill('input[placeholder="Pickup location"]', '123 Main St');
    await page.fill('input[placeholder="Destination"]', '456 Oak Ave');
    await page.click('button:has-text("Request Ride")');
    
    // Verify booking confirmation
    await expect(page.locator('text=Ride requested successfully')).toBeVisible();
    
    // Check ride status
    await page.click('text=My Rides');
    await expect(page.locator('[data-status="PENDING"]')).toBeVisible();
  });

  test('should display ride history', async ({ page }) => {
    await page.goto('http://localhost:4000/rides');
    
    // Should show login if not authenticated
    await expect(page.locator('text=Login')).toBeVisible();
  });

  test('should handle payment flow', async ({ page }) => {
    // TODO: Implement payment test flow
  });
});

test.describe('Driver App - Accept Ride Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4001'); // driver-app
  });

  test('driver can accept assigned ride', async ({ page }) => {
    // Login as driver
    await page.click('text=Login');
    await page.fill('input[name="email"]', 'driver@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Go online
    await page.click('button:has-text("Go Online")');
    
    // Wait for ride assignment
    await page.waitForSelector('[data-testid="ride-notification"]', { timeout: 30000 });
    
    // Accept ride
    await page.click('button:has-text("Accept")');
    
    // Verify ride details shown
    await expect(page.locator('text=Ride Details')).toBeVisible();
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4002'); // admin-dashboard
  });

  test('should display system metrics', async ({ page }) => {
    await page.click('text=Login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('[data-metric="total-rides"]')).toBeVisible();
    await expect(page.locator('[data-metric="active-drivers"]')).toBeVisible();
  });
});
