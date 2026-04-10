const BASE_URL = 'http://127.0.0.1:4000';
const API_BASE = 'http://127.0.0.1:3000/api';

const CUSTOMER_PHONE = Cypress.env('SMOKE_CUSTOMER_PHONE') || '0901234565';
const SEED_PASSWORD = Cypress.env('SMOKE_PASSWORD') || 'Password@1';
const PICKUP_QUERY = Cypress.env('SMOKE_PICKUP_QUERY') || 'Ben Thanh';
const DROPOFF_QUERY = Cypress.env('SMOKE_DROPOFF_QUERY') || 'Tan Son Nhat Airport';

const loginWithPassword = () => {
  cy.visit(`${BASE_URL}/login`, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
  });

  cy.get('input').first().clear().type(CUSTOMER_PHONE);
  cy.get('input[type="password"]').clear().type(SEED_PASSWORD);
  cy.get('button[type="submit"]').click();
  cy.location('pathname', { timeout: 30000 }).should('eq', '/home');
};

const chooseAutocompleteLocation = (selector: string, query: string) => {
  cy.get(selector, { timeout: 30000 }).click({ force: true });
  cy.get(selector, { timeout: 30000 }).clear({ force: true });
  cy.get(selector, { timeout: 30000 }).type(query, { delay: 50, force: true });
  cy.get('[role="option"]', { timeout: 15000 }).first().click({ force: true });
};

const cancelActiveRide = () => {
  cy.request({
    method: 'POST',
    url: `${API_BASE}/auth/login`,
    body: { phone: CUSTOMER_PHONE, password: SEED_PASSWORD },
    failOnStatusCode: false,
  }).then((loginRes) => {
    if (loginRes.status !== 200) {
      return;
    }

    const token: string | undefined = loginRes.body?.data?.tokens?.accessToken;
    if (!token) {
      return;
    }

    cy.request({
      method: 'GET',
      url: `${API_BASE}/rides/customer/active`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((activeRes) => {
      const rideId: string | undefined = activeRes.body?.data?.ride?.id;
      if (!rideId) {
        return;
      }

      cy.request({
        method: 'POST',
        url: `${API_BASE}/rides/${rideId}/cancel`,
        headers: { Authorization: `Bearer ${token}` },
        body: { reason: 'test-cleanup' },
        failOnStatusCode: false,
      });
    });
  });
};

describe('Browser smoke ride lifecycle', () => {
  beforeEach(() => {
    cancelActiveRide();
  });

  it('creates a ride and opens tracking screen from booking flow', () => {
    loginWithPassword();

    chooseAutocompleteLocation('[data-testid="pickup-location-input"]', PICKUP_QUERY);
    chooseAutocompleteLocation('[data-testid="dropoff-location-input"]', DROPOFF_QUERY);

    cy.get('[data-testid="open-booking-flow"]', { timeout: 30000 }).should('not.be.disabled').click({ force: true });
    cy.get('[data-testid="ride-booking-flow"]', { timeout: 30000 }).scrollIntoView().should('be.visible');
    cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).scrollIntoView().should('not.be.disabled').click();
    cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).scrollIntoView().should('not.be.disabled').click();
    cy.get('[data-testid="confirm-booking-button"]', { timeout: 30000 }).scrollIntoView().should('not.be.disabled').click();

    cy.location('pathname', { timeout: 30000 }).should('match', /^\/ride\/[0-9a-f-]+$/);
    cy.contains(/Tìm tài xế|Đang tìm tài xế|Đang cập nhật|ETA/i, { timeout: 30000 }).should('exist');
  });
});
