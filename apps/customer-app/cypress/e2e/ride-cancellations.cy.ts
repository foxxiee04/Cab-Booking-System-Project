const CUSTOMER_ORIGIN = 'http://localhost:4000';
const DRIVER_ORIGIN = 'http://localhost:4001';
const ADMIN_ORIGIN = 'http://localhost:4002';

const CUSTOMER_PHONE = Cypress.env('SMOKE_CUSTOMER_PHONE') || '0901234565';
const DRIVER_PHONE   = Cypress.env('SMOKE_DRIVER_PHONE')   || '0911234561';
const ADMIN_PHONE    = Cypress.env('SMOKE_ADMIN_PHONE')    || '0900000001';

const PICKUP_QUERY = Cypress.env('SMOKE_PICKUP_QUERY') || 'Ben Thanh';
const DROPOFF_QUERY = Cypress.env('SMOKE_DROPOFF_QUERY') || 'Tan Son Nhat Airport';
const SEED_PASSWORD = Cypress.env('SMOKE_PASSWORD') || 'Password@1';

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

const loginAdmin = () => {
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
};

const loginDriver = () => {
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
};

const createRide = () => {
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
  return cy.location('pathname').then((pathname) => pathname.split('/').pop() || '');
};

describe('Browser smoke ride cancellations', () => {
  const API_BASE = 'http://localhost:3000/api';

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

  beforeEach(() => {
    cancelActiveRide(CUSTOMER_PHONE, SEED_PASSWORD);
  });

  it('lets the customer cancel an unassigned ride and shows it in admin', () => {
    loginWithPassword(CUSTOMER_PHONE, '/home');
    loginAdmin();

    createRide().then((rideId) => {
      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'Đang tìm tài xế');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('button', 'Hủy chuyến', { timeout: 30000 }).click();
      cy.location('pathname', { timeout: 30000 }).should('eq', '/home');

      cy.visit('/activity');
      cy.contains('Đang diễn ra', { timeout: 30000 }).click();
      cy.contains('Chưa có chuyến nào đang diễn ra', { timeout: 30000 });

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'Đã hủy');
      });
    });
  });

  it('lets the driver cancel an accepted ride and propagates the status to customer and admin', () => {
    loginWithPassword(CUSTOMER_PHONE, '/home');
    loginDriver();
    loginAdmin();

    cy.origin(DRIVER_ORIGIN, () => {
      cy.visit('/dashboard');
      cy.get('[data-testid="driver-online-toggle"]', { timeout: 30000 }).then(($toggle) => {
        if (!$toggle.is(':checked')) {
          cy.wrap($toggle).check({ force: true });
        }
      });
      cy.contains('Bạn đang trực tuyến', { timeout: 30000 });
    });

    createRide().then((rideId) => {
      cy.origin(DRIVER_ORIGIN, () => {
        cy.visit('/dashboard');
        cy.get('[data-testid="accept-ride-button"]', { timeout: 60000 }).first().scrollIntoView().click({ force: true });
        cy.location('pathname', { timeout: 30000 }).should('eq', '/active-ride');
        cy.get('[data-testid="cancel-ride-button"]', { timeout: 30000 }).scrollIntoView().click({ force: true });
        cy.get('[data-testid="confirm-cancel-ride-button"]', { timeout: 30000 }).click();
        cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('Chuyến đi đã hủy', { timeout: 30000 });

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'Đã hủy');
      });
    });
  });
});
