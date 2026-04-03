const CUSTOMER_ORIGIN = 'http://localhost:4000';
const DRIVER_ORIGIN = 'http://localhost:4001';
const ADMIN_ORIGIN = 'http://localhost:4002';

const CUSTOMER_PHONE = Cypress.env('SMOKE_CUSTOMER_PHONE') || '0901234565';
const DRIVER_PHONE   = Cypress.env('SMOKE_DRIVER_PHONE')   || '0911234561';
const ADMIN_PHONE    = Cypress.env('SMOKE_ADMIN_PHONE')    || '0900000001';

const PICKUP_QUERY = Cypress.env('SMOKE_PICKUP_QUERY') || 'Ben Thanh';
const DROPOFF_QUERY = Cypress.env('SMOKE_DROPOFF_QUERY') || 'Tan Son Nhat Airport';
const REVIEW_COMMENT =
  Cypress.env('SMOOTH_REVIEW_COMMENT') || 'Browser smoke flow da hoan tat on dinh.';
const SEED_PASSWORD = Cypress.env('SMOKE_PASSWORD') || 'Password@1';

/**
 * Login helper using phone + password.
 */
const loginWithPassword = (phone: string, landingPath: string) => {
  cy.visit('/login', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
  });

  cy.get('input').first().clear().type(phone);
  cy.get('input[type="password"]').clear().type(SEED_PASSWORD);
  cy.get('button[type="submit"]').click();

  cy.location('pathname', { timeout: 30000 }).should('eq', landingPath);
};

/** Login helper for use inside cy.origin() blocks (uses cy.intercept within origin). */
const originLoginWithPassword = (phone: string, password: string, landingPath: string) => {
  cy.visit('/login', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
  });

  cy.get('input').first().clear().type(phone);
  cy.get('input[type="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();

  cy.location('pathname', { timeout: 30000 }).should('eq', landingPath);
};

const nativeClick = (selector: string) => {
  cy.get(selector, { timeout: 30000 }).should('exist').then(($element) => {
    const node = $element.get(0) as HTMLElement;
    node.click();
  });
};

const nativeClickButtonByText = (label: string) => {
  cy.contains('button', label, { timeout: 30000 }).should('exist').then(($element) => {
    const node = $element.get(0) as HTMLElement;
    node.click();
  });
};

const chooseAutocompleteLocation = (selector: string, query: string) => {
  cy.get(selector, { timeout: 30000 }).click({ force: true });
  cy.get(selector, { timeout: 30000 }).clear({ force: true });
  cy.get(selector, { timeout: 30000 }).type(query, {
    delay: 50,
    force: true,
  });
  // Wait for autocomplete dropdown to appear, then click the first option
  cy.get('[role="option"]', { timeout: 15000 }).first().click({ force: true });
};

const captureLeadingNumber = (selector: string) => {
  return cy.get(selector, { timeout: 30000 }).invoke('text').then((text) => {
    const match = text.match(/\d+/);

    if (!match) {
      throw new Error(`Could not extract number from: ${text}`);
    }

    return Number(match[0]);
  });
};

describe('Browser smoke ride lifecycle', () => {
  const API_BASE = 'http://localhost:3000/api';

  /** Cancel any active/in-progress ride for a user so the home page is available. */
  const cancelActiveRide = (phone: string, password: string) => {
    cy.request({ method: 'POST', url: `${API_BASE}/auth/login`, body: { phone, password }, failOnStatusCode: false })
      .then((loginRes) => {
        if (loginRes.status !== 200) return;
        const token: string = loginRes.body?.data?.tokens?.accessToken;
        cy.request({ method: 'GET', url: `${API_BASE}/rides/customer/active`, headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false })
          .then((activeRes) => {
            const rideId: string | undefined = activeRes.body?.data?.ride?.id;
            if (rideId) {
              cy.request({ method: 'POST', url: `${API_BASE}/rides/${rideId}/cancel`, headers: { Authorization: `Bearer ${token}` }, body: { reason: 'test-cleanup' }, failOnStatusCode: false });
            }
          });
      });
  };

  before(() => {
    cancelActiveRide(CUSTOMER_PHONE, SEED_PASSWORD);
  });

  it('completes one ride across customer, driver, and admin via UI only', () => {
    loginWithPassword(CUSTOMER_PHONE, '/home');

    cy.visit('/activity');

    cy.origin(
      DRIVER_ORIGIN,
      { args: { phone: DRIVER_PHONE, password: SEED_PASSWORD } },
      ({ phone, password }) => {
        cy.request({
          method: 'POST',
          url: 'http://localhost:3000/api/auth/login',
          body: { identifier: phone, password },
        }).then(({ body }) => {
          window.localStorage.setItem('accessToken', body.data.tokens.accessToken);
          window.localStorage.setItem('refreshToken', body.data.tokens.refreshToken);
          window.localStorage.setItem('user', JSON.stringify(body.data.user));
        });
        cy.visit('/dashboard');
        cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
      }
    );

    cy.origin(
      ADMIN_ORIGIN,
      { args: { phone: ADMIN_PHONE, password: SEED_PASSWORD } },
      ({ phone, password }) => {
        cy.request({
          method: 'POST',
          url: 'http://localhost:3000/api/auth/login',
          body: { identifier: phone, password },
        }).then(({ body }) => {
          window.localStorage.setItem('accessToken', body.data.tokens.accessToken);
          window.localStorage.setItem('refreshToken', body.data.tokens.refreshToken);
          window.localStorage.setItem('user', JSON.stringify(body.data.user));
        });
        cy.visit('/dashboard');
        cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
      }
    );

    cy.origin(DRIVER_ORIGIN, () => {
      cy.visit('/dashboard');
      cy.get('[data-testid="driver-online-toggle"]', { timeout: 30000 }).then(($toggle) => {
        if (!$toggle.is(':checked')) {
          cy.wrap($toggle).check({ force: true });
        }
      });
      cy.contains('Bạn đang trực tuyến', { timeout: 30000 });
    });

    cy.visit('/home');
    chooseAutocompleteLocation('[data-testid="pickup-location-input"]', PICKUP_QUERY);
    chooseAutocompleteLocation('[data-testid="dropoff-location-input"]', DROPOFF_QUERY);

    // Wait until both locations are set in Redux (button becomes enabled) then click
    cy.get('[data-testid="open-booking-flow"]', { timeout: 30000 }).should('not.be.disabled').click({ force: true });
    cy.get('[data-testid="ride-booking-flow"]', { timeout: 30000 }).scrollIntoView().should('be.visible');
    cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).scrollIntoView().should('not.be.disabled').click();
    cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).scrollIntoView().should('not.be.disabled').click();
    cy.get('[data-testid="confirm-booking-button"]', { timeout: 30000 }).scrollIntoView().click();
    cy.location('pathname', { timeout: 30000 }).should('match', /^\/ride\/[0-9a-f-]+$/);
    cy.location('pathname').then((pathname) => pathname.split('/').pop() || '').as('rideId');

    cy.get('@rideId').then((rideIdValue) => {
      const rideId = String(rideIdValue);

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should(
          'contain.text',
          'Đang tìm tài xế'
        );
      });

      cy.origin(DRIVER_ORIGIN, () => {
        cy.visit('/dashboard');
        cy.get('[data-testid="accept-ride-button"]', { timeout: 60000 }).first().scrollIntoView().click({ force: true });
        cy.location('pathname', { timeout: 30000 }).should('eq', '/active-ride');
        cy.get('[data-testid="pickup-ride-button"]', { timeout: 30000 }).click();
        cy.get('[data-testid="start-ride-button"]', { timeout: 30000 }).click();
        cy.get('[data-testid="complete-ride-button"]', { timeout: 30000 }).click();
        cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('Chuyến đi đã hoàn thành', { timeout: 30000 });
      cy.get('[data-testid="payment-status-chip"]', { timeout: 30000 }).should(
        'contain.text',
        'Đã thanh toán'
      );
      cy.get('[data-testid="review-comment-input"]', { timeout: 30000 })
        .clear()
        .type(REVIEW_COMMENT, { force: true });
      cy.get('[data-testid="submit-review-button"]', { timeout: 30000 }).click();
      cy.contains('Đánh giá của bạn', { timeout: 15000 });

      cy.visit('/activity');
      cy.contains('Lịch sử', { timeout: 30000 }).click();
      cy.get('.MuiCard-root', { timeout: 30000 }).its('length').should('be.gte', 1);

      cy.origin(DRIVER_ORIGIN, () => {
        cy.visit('/history');
        cy.get('.MuiCard-root', { timeout: 30000 }).its('length').should('be.gte', 1);

        cy.visit('/earnings');
        cy.get('.MuiCard-root', { timeout: 30000 }).last().invoke('text').should('match', /\d+/);
      });

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should(
          'contain.text',
          'Hoàn tất'
        );
        cy.visit('/payments');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should(
          'contain.text',
          'COMPLETED'
        );
      });
    });
  });
});