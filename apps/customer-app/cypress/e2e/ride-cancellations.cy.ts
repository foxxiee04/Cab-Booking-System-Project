const CUSTOMER_ORIGIN = 'http://localhost:4000';
const DRIVER_ORIGIN = 'http://localhost:4001';
const ADMIN_ORIGIN = 'http://localhost:4002';

const PASSWORD = Cypress.env('SMOKE_PASSWORD') || 'password123';
const CUSTOMER_EMAIL = Cypress.env('SMOKE_CUSTOMER_EMAIL') || 'customer1@example.com';
const DRIVER_EMAIL = Cypress.env('SMOKE_DRIVER_EMAIL') || 'driver1@example.com';
const ADMIN_EMAIL = Cypress.env('SMOKE_ADMIN_EMAIL') || 'admin@cabbooking.com';

const PICKUP_QUERY = Cypress.env('SMOKE_PICKUP_QUERY') || 'Ben Thanh';
const DROPOFF_QUERY = Cypress.env('SMOKE_DROPOFF_QUERY') || 'Tan Son Nhat Airport';

const resetAndLogin = (email: string, landingPath: string) => {
  cy.visit('/login', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
  });

  cy.get('input[type="email"]').clear().type(email);
  cy.get('input[type="password"]').clear().type(PASSWORD, { log: false });
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
    delay: 40,
    force: true,
  });
  cy.wait(1200);
  cy.get(selector, { timeout: 30000 }).type('{downarrow}{enter}', { force: true });
};

const loginAdmin = () => {
  cy.origin(
    ADMIN_ORIGIN,
    { args: { email: ADMIN_EMAIL, password: PASSWORD } },
    ({ email, password }) => {
      cy.visit('/login', {
        onBeforeLoad(win) {
          win.localStorage.clear();
          win.sessionStorage.clear();
        },
      });

      cy.get('input[type="email"]').clear().type(email);
      cy.get('input[type="password"]').clear().type(password, { log: false });
      cy.get('button[type="submit"]').click();
      cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
    }
  );
};

const loginDriver = () => {
  cy.origin(
    DRIVER_ORIGIN,
    { args: { email: DRIVER_EMAIL, password: PASSWORD } },
    ({ email, password }) => {
      cy.visit('/login', {
        onBeforeLoad(win) {
          win.localStorage.clear();
          win.sessionStorage.clear();
        },
      });

      cy.get('input[type="email"]').clear().type(email);
      cy.get('input[type="password"]').clear().type(password, { log: false });
      cy.get('button[type="submit"]').click();
      cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
    }
  );
};

const createRide = () => {
  cy.visit('/home');
  chooseAutocompleteLocation('[data-testid="pickup-location-input"]', PICKUP_QUERY);
  chooseAutocompleteLocation('[data-testid="dropoff-location-input"]', DROPOFF_QUERY);

  nativeClickButtonByText('Tiếp tục đặt xe');
  cy.get('[data-testid="ride-booking-flow"]', { timeout: 30000 }).should('be.visible');
  cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).should('not.be.disabled').click();
  cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).should('not.be.disabled').click();
  cy.get('[data-testid="confirm-booking-button"]', { timeout: 30000 }).click();
  cy.location('pathname', { timeout: 30000 }).should('match', /^\/ride\/[0-9a-f-]+$/);
  return cy.location('pathname').then((pathname) => pathname.split('/').pop() || '');
};

describe('Browser smoke ride cancellations', () => {
  it('lets the customer cancel an unassigned ride and shows it in admin', () => {
    resetAndLogin(CUSTOMER_EMAIL, '/home');
    loginAdmin();

    createRide().then((rideId) => {
      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'FINDING_DRIVER');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('button', 'Huy chuyen', { timeout: 30000 }).click();
      cy.location('pathname', { timeout: 30000 }).should('eq', '/home');

      cy.visit('/activity');
      cy.contains('Đang diễn ra', { timeout: 30000 }).click();
      cy.contains('Chưa có chuyến nào đang diễn ra', { timeout: 30000 });

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'CANCELLED');
      });
    });
  });

  it('lets the driver cancel an accepted ride and propagates the status to customer and admin', () => {
    resetAndLogin(CUSTOMER_EMAIL, '/home');
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
        cy.get('[data-testid="accept-ride-button"]', { timeout: 30000 }).should('be.visible').click();
        cy.location('pathname', { timeout: 30000 }).should('eq', '/active-ride');
        cy.contains('button', /cancel|huy/i, { timeout: 30000 }).click();
        cy.get('[role="dialog"] .MuiDialogActions-root button', { timeout: 30000 }).last().click();
        cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('Chuyen di da huy', { timeout: 30000 });

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'CANCELLED');
      });
    });
  });
});