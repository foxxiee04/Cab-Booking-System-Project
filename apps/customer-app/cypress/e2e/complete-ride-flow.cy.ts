/// <reference types="cypress" />

const BASE_URL = 'http://127.0.0.1:4000';
const API_URL = 'http://127.0.0.1:3000/api';

const EXISTING_USER = {
  phone: Cypress.env('SMOKE_CUSTOMER_PHONE') || '0901234565',
  password: Cypress.env('SMOKE_PASSWORD') || 'Password@1',
};

const loginExistingUser = () => {
  cy.visit(`${BASE_URL}/login`, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
  });

  cy.get('input').first().clear().type(EXISTING_USER.phone);
  cy.get('input[type="password"]').clear().type(EXISTING_USER.password);
  cy.get('button[type="submit"]').click();
  cy.location('pathname', { timeout: 30000 }).should('include', '/home');
};

const cancelActiveRide = () => {
  cy.request({
    method: 'POST',
    url: `${API_URL}/auth/login`,
    body: { phone: EXISTING_USER.phone, password: EXISTING_USER.password },
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
      url: `${API_URL}/rides/customer/active`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((activeRes) => {
      const rideId: string | undefined = activeRes.body?.data?.ride?.id;
      if (!rideId) {
        return;
      }

      cy.request({
        method: 'POST',
        url: `${API_URL}/rides/${rideId}/cancel`,
        headers: { Authorization: `Bearer ${token}` },
        body: { reason: 'complete-flow-cleanup' },
        failOnStatusCode: false,
      });
    });
  });
};

describe('Complete Customer Ride Flow', () => {
  beforeEach(() => {
    cancelActiveRide();
  });

  it('logs in and renders home booking map', () => {
    loginExistingUser();

    cy.get('[data-testid="pickup-location-input"]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="dropoff-location-input"]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="open-booking-flow"]', { timeout: 30000 }).should('exist');
    cy.contains('Bạn muốn đi đâu hôm nay?', { timeout: 30000 }).should('be.visible');
  });
});
