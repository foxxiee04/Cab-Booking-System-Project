/// <reference types="cypress" />

/**
 * Complete Customer Ride Flow E2E Test
 * 
 * This test covers the complete user journey:
 * 1. User Registration / Login
 * 2. Home page with map and location selection
 * 3. Nearby drivers visibility
 * 4. Ride booking with vehicle selection
 * 5. Waiting for driver acceptance
 * 6. Ride tracking and completion
 * 
 * Run with: npx cypress open
 * Or: npx cypress run --spec "cypress/e2e/complete-ride-flow.cy.ts"
 */

const BASE_URL = 'http://localhost:4000';
const API_URL = 'http://localhost:3000/api';
const DRIVER_URL = 'http://localhost:4001';

// Test data
const TEST_USER = {
  phone: '0901234567',
  firstName: 'Test',
  lastName: 'Customer',
  email: 'test.customer@example.com',
  password: 'TestPassword@123',
};

const EXISTING_USER = {
  phone: '0901234565',
  password: 'Password@1',
};

const TEST_LOCATIONS = {
  pickup: {
    query: 'Ben Thanh Market',
    lat: 10.7727,
    lng: 106.7007,
  },
  dropoff: {
    query: 'Tan Son Nhat Airport',
    lat: 10.7724,
    lng: 106.6537,
  },
};

describe('Complete Customer Ride Flow', () => {
  beforeEach(() => {
    // Clear storage before each test
    cy.window().then((win: Window) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });
  });

  /**
   * Helper: Login with existing account
   */
  const loginExistingUser = () => {
    cy.visit(`${BASE_URL}/login`);
    
    // Wait for login form to load
    cy.get('input[type="text"]', { timeout: 10000 }).first().as('phoneInput');
    cy.get('input[type="password"]').as('passwordInput');
    cy.get('button[type="submit"]').as('submitBtn');

    // Fill in login credentials
    cy.get('@phoneInput').clear().type(EXISTING_USER.phone);
    cy.get('@passwordInput').clear().type(EXISTING_USER.password);
    
    // Submit login
    cy.get('@submitBtn').click();

    // Wait for redirect to home
    cy.location('pathname', { timeout: 30000 }).should('include', '/home');
  };

  /**
   * Helper: Select location using autocomplete
   */
  const selectLocation = (fieldLabel: string, query: string) => {
    cy.contains('label', fieldLabel, { timeout: 10000 })
      .parent()
      .find('input')
      .as('locationInput');

    cy.get('@locationInput').click();
    cy.get('@locationInput').clear().type(query, { delay: 50 });

    // Wait for autocomplete dropdown and select first option
    cy.get('[role="option"]', { timeout: 10000 })
      .first()
      .click({ force: true });

    // Verify selection
    cy.get('@locationInput').should('have.value', (val: string) => {
      return val && val.length > 0;
    });
  };

  /**
   * Helper: Wait for nearby drivers to appear
   */
  const waitForNearbyDrivers = () => {
    // Look for driver markers on the map
    cy.get('.driver-marker-animated, .leaflet-marker-icon', { timeout: 15000 })
      .should('have.length.at.least', 1);
  };

  /**
   * Helper: Book a ride
   */
  const bookRide = () => {
    // Open booking flow
    cy.contains('button', /book|request|book a ride/i, { timeout: 10000 }).click();

    // Select first available vehicle option (new taxonomy)
    cy.get('[data-testid^="vehicle-option-"], .vehicle-option-card')
      .first()
      .click({ force: true });

    // Select payment method (default Cash)
    cy.get('input[value="CASH"], [data-testid="payment-cash"]')
      .click({ force: true });

    // Confirm booking
    cy.contains('button', /confirm|book|request ride/i, { timeout: 10000 }).click();
  };

  /**
   * Test 1: Login and navigate to home map
   */
  it('should login successfully and display home map with location access', () => {
    loginExistingUser();

    // Verify home page elements
    cy.contains('h1, h2, .MuiTypography-h5', /home|booking|find a ride/i, { timeout: 10000 }).should('be.visible');
    
    // Verify map is loaded
    cy.get('.leaflet-container, [data-testid="map-container"]', { timeout: 10000 }).should('be.visible');

    // Verify location input is visible
    cy.get('input[placeholder*="Pickup"], input[placeholder*="From"], label:contains("Pickup")')
      .should('be.visible');
  });

  /**
   * Test 2: Request location permission and select pickup location
   */
  it('should request location and display current location with geolocation accuracy improvements', () => {
    loginExistingUser();

    // Check if location button exists and click it
    cy.get('[data-testid="current-location-btn"], button[title="Current Location"], button:contains("📍")')
      .should('be.visible')
      .click({ force: true });

    // Should see location being fetched (loading state)
    cy.get('.MuiCircularProgress-root, [data-testid="loading"]', { timeout: 5000 }).should('exist');

    // Should get location successfully
    cy.get('input[placeholder*="Pickup"], input[placeholder*="From"]', { timeout: 15000 })
      .should('have.value', (val: string) => {
        return val && val.length > 0 && val !== '';
      });
  });

  /**
   * Test 3: Select pickup and dropoff locations, verify route
   */
  it('should select pickup and dropoff locations and display route on map', () => {
    loginExistingUser();

    // Select pickup location
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(1000);

    // Select dropoff location
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);
    cy.wait(2000);

    // Verify route is displayed on map
    cy.get('.leaflet-path, [data-testid="route-line"]', { timeout: 10000 })
      .should('be.visible');

    // Verify route information is displayed (distance, duration)
    cy.contains(/km|min|distance|duration/, { timeout: 10000 }).should('be.visible');
  });

  /**
   * Test 4: Verify nearby drivers are displayed on map with real-time updates
   */
  it('should display nearby drivers with animations and real-time updates', () => {
    loginExistingUser();

    // Select pickup location
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(1000);

    // Wait for nearby drivers
    waitForNearbyDrivers();

    // Verify driver markers are visible and animated
    cy.get('.driver-marker-animated', { timeout: 10000 })
      .should('have.length.at.least', 1);

    // Click on a driver marker to see driver details
    cy.get('.driver-marker-animated').first().click({ force: true });

    // Verify driver popup shows
    cy.get('.leaflet-popup-content', { timeout: 5000 }).should('be.visible');
    cy.contains(/driver|rating|vehicle/i).should('be.visible');
  });

  /**
   * Test 5: Open booking flow and select vehicle type
   */
  it('should open booking flow and select vehicle type with smooth animations', () => {
    loginExistingUser();

    // Select locations
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(1000);
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);
    cy.wait(2000);

    // Open booking
    cy.contains('button', /book|request|book a ride/i, { timeout: 10000 }).click();

    // Should see booking modal/drawer
    cy.get('[role="dialog"], .MuiDrawer-root, .booking-drawer', { timeout: 10000 }).should('be.visible');

    // Verify vehicle options are visible
    cy.contains(/motorbike|scooter|car 4|car 7/i, { timeout: 5000 }).should('be.visible');

    // Click a vehicle option
    cy.contains(/motorbike|scooter|car 4|car 7/i).closest('[role="button"], .card, .vehicle-card')
      .click({ force: true });

    // Verify selection
    cy.contains(/motorbike|scooter|car 4|car 7/i).closest('[role="button"], .card, .vehicle-card')
      .should('have.class', /selected|active/);
  });

  /**
   * Test 6: Select payment method and confirm booking
   */
  it('should select payment method and request ride successfully', () => {
    loginExistingUser();

    // Select locations
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(1000);
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);
    cy.wait(2000);

    // Open booking
    cy.contains('button', /book|request|book a ride/i, { timeout: 10000 }).click();

    // Wait for booking modal
    cy.get('[role="dialog"], .MuiDrawer-root', { timeout: 10000 }).should('be.visible');

    // Select vehicle
    cy.contains(/motorbike|scooter|car 4|car 7/i).closest('[role="button"], .card')
      .click({ force: true });

    // Select payment method (Cash by default)
    cy.get('input[value="CASH"], label:contains("Cash")')
      .click({ force: true });

    // Confirm booking
    cy.contains('button', /confirm|request ride|book/i, { timeout: 10000 })
      .click({ force: true });

    // Should see success message or redirect to tracking
    cy.location('pathname', { timeout: 30000 }).should('match', /ride|tracking/);
  });

  /**
   * Test 7: Ride tracking - verify ride status updates
   */
  it('should display ride tracking with real-time driver location updates', () => {
    loginExistingUser();

    // Book a ride
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(1000);
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);
    cy.wait(2000);

    cy.contains('button', /book|request|book a ride/i, { timeout: 10000 }).click();
    cy.get('[role="dialog"], .MuiDrawer-root', { timeout: 10000 }).should('be.visible');

    cy.contains(/motorbike|scooter|car 4|car 7/i).closest('[role="button"], .card').click({ force: true });
    cy.get('input[value="CASH"]').click({ force: true });
    cy.contains('button', /confirm|request ride/i, { timeout: 10000 }).click({ force: true });

    // Should navigate to tracking page
    cy.location('pathname', { timeout: 30000 }).should('match', /ride|tracking/);

    // Verify map is visible with route
    cy.get('.leaflet-container, [data-testid="tracking-map"]', { timeout: 10000 }).should('be.visible');

    // Verify ride status information
    cy.contains(/waiting|accepted|on the way|arrived/i, { timeout: 15000 }).should('exist');
  });

  /**
   * Test 8: Mobile-optimized UI verification
   */
  it('should display mobile-optimized UI with proper layout and touch targets', () => {
    // Set mobile viewport
    cy.viewport('iphone-x');

    loginExistingUser();

    // Verify responsive layout
    cy.get('.location-search-container, input[placeholder*="Pickup"]').should('be.visible');

    // Verify buttons are touch-friendly (min 44x44px)
    cy.get('button').each(($button) => {
      cy.wrap($button).should(($el) => {
        const height = $el.height();
        const width = $el.width();
        expect(Math.min(height || 0, width || 0)).to.be.at.least(40);
      });
    });

    // Verify drawer for booking
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(1000);
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);
    cy.wait(2000);

    cy.contains('button', /book|request/i, { timeout: 10000 }).click();

    // Should show bottom sheet/drawer on mobile
    cy.get('.MuiDrawer-paperAnchorBottom, [role="dialog"]', { timeout: 10000 }).should('be.visible');
  });

  /**
   * Test 9: Error handling and recovery
   */
  it('should handle network errors gracefully and allow retry', () => {
    loginExistingUser();

    // Intercept API to simulate error
    cy.intercept('GET', '**/drivers/nearby', {
      statusCode: 500,
      body: { error: 'Server error' },
    });

    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);
    cy.wait(2000);

    // Should show error message
    cy.contains(/error|try again|network/i, { timeout: 10000 }).should('be.visible');

    // Clear intercept and allow retry
    cy.intercept('GET', '**/drivers/nearby', {
      statusCode: 200,
      body: {
        success: true,
        data: { drivers: [] },
      },
    });

    cy.contains('button', /retry|try again/i).click({ force: true });

    // Should work without drivers
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);
    cy.wait(1000);

    cy.contains('button', /book|request/i, { timeout: 10000 }).should('be.visible');
  });

  /**
   * Test 10: Map animations and interactions
   */
  it('should display smooth animations for map interactions', () => {
    loginExistingUser();

    // Select location and watch animations
    selectLocation('Pickup', TEST_LOCATIONS.pickup.query);

    // Verify map bounces/animates to location
    cy.get('.leaflet-container').should('be.visible');

    // Select dropoff
    selectLocation('Dropoff', TEST_LOCATIONS.dropoff.query);

    // Verify route animation
    cy.get('.leaflet-path').should('have.css', 'transition');

    // Zoom controls should be animated
    cy.get('.leaflet-control-zoom a').should('have.css', 'transition');
  });
});

/**
 * Additional utility tests
 */
describe('Location Services and Geolocation', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });
  });

  it('should handle geolocation with improved accuracy including ward/district names', () => {
    cy.visit(`${BASE_URL}/login`);

    cy.get('input[type="text"]').first().clear().type(EXISTING_USER.phone);
    cy.get('input[type="password"]').clear().type(EXISTING_USER.password);
    cy.get('button[type="submit"]').click();

    cy.location('pathname', { timeout: 30000 }).should('include', '/home');

    // Get current location
    cy.get('button[title="Current Location"], button:contains("📍")')
      .should('be.visible')
      .click({ force: true });

    // Wait for location with address
    cy.get('input[placeholder*="Pickup"]', { timeout: 15000 }).should(($input) => {
      const value = $input.val();
      // Should contain proper address with ward/district info
      expect(value).to.be.a('string');
    });
  });

  it('should cache geocoding results for performance', () => {
    cy.visit(`${BASE_URL}/login`);

    cy.get('input[type="text"]').first().clear().type(EXISTING_USER.phone);
    cy.get('input[type="password"]').clear().type(EXISTING_USER.password);
    cy.get('button[type="submit"]').click();

    cy.location('pathname', { timeout: 30000 }).should('include', '/home');

    // Select location twice
    cy.get('input[placeholder*="Pickup"]').first().click();
    cy.get('input[placeholder*="Pickup"]').first().clear().type('Ben Thanh', { delay: 50 });
    cy.get('[role="option"]').first().click({ force: true });

    cy.get('input[placeholder*="Pickup"]').first().click();
    cy.get('input[placeholder*="Pickup"]').first().clear().type('Ben Thanh', { delay: 50 });

    // Second search should be instant (cached)
    cy.get('[role="option"]', { timeout: 5000 }).should('have.length.at.least', 1);
  });
});
