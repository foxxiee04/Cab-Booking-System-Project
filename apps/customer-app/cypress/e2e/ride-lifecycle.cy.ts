const CUSTOMER_ORIGIN = 'http://localhost:4000';
const DRIVER_ORIGIN = 'http://localhost:4001';
const ADMIN_ORIGIN = 'http://localhost:4002';

const PASSWORD = Cypress.env('SMOKE_PASSWORD') || 'password123';
const CUSTOMER_EMAIL = Cypress.env('SMOKE_CUSTOMER_EMAIL') || 'customer1@example.com';
const DRIVER_EMAIL = Cypress.env('SMOKE_DRIVER_EMAIL') || 'driver1@example.com';
const ADMIN_EMAIL = Cypress.env('SMOKE_ADMIN_EMAIL') || 'admin@cabbooking.com';

const PICKUP_QUERY = Cypress.env('SMOKE_PICKUP_QUERY') || 'Ben Thanh';
const DROPOFF_QUERY = Cypress.env('SMOKE_DROPOFF_QUERY') || 'Tan Son Nhat Airport';
const REVIEW_COMMENT =
  Cypress.env('SMOKE_REVIEW_COMMENT') || 'Browser smoke flow da hoan tat on dinh.';

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
    delay: 40,
    force: true,
  });
  cy.wait(1200);
  cy.get(selector, { timeout: 30000 }).type('{downarrow}{enter}', { force: true });
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
  it('completes one ride across customer, driver, and admin via UI only', () => {
    resetAndLogin(CUSTOMER_EMAIL, '/home');

    cy.visit('/activity');
    captureLeadingNumber('.MuiCard-root:first-of-type').as('customerCompletedBefore');

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

    nativeClickButtonByText('Tiếp tục đặt xe');
    cy.get('[data-testid="ride-booking-flow"]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).should('not.be.disabled').click();
    cy.get('[data-testid="ride-booking-next"]', { timeout: 30000 }).should('not.be.disabled').click();
    cy.get('[data-testid="confirm-booking-button"]', { timeout: 30000 }).click();
    cy.location('pathname', { timeout: 30000 }).should('match', /^\/ride\/[0-9a-f-]+$/);
    cy.location('pathname').then((pathname) => pathname.split('/').pop() || '').as('rideId');

    cy.get('@rideId').then((rideIdValue) => {
      const rideId = String(rideIdValue);

      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should(
          'contain.text',
          'FINDING_DRIVER'
        );
      });

      cy.origin(DRIVER_ORIGIN, () => {
        cy.visit('/dashboard');
        cy.get('[data-testid="accept-ride-button"]', { timeout: 30000 }).should('be.visible').click();
        cy.location('pathname', { timeout: 30000 }).should('eq', '/active-ride');
        cy.get('[data-testid="pickup-ride-button"]', { timeout: 30000 }).click();
        cy.get('[data-testid="start-ride-button"]', { timeout: 30000 }).click();
        cy.get('[data-testid="complete-ride-button"]', { timeout: 30000 }).click();
        cy.location('pathname', { timeout: 30000 }).should('eq', '/dashboard');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('Chuyen di da hoan thanh', { timeout: 30000 });
      cy.get('[data-testid="payment-status-chip"]', { timeout: 30000 }).should(
        'contain.text',
        'COMPLETED'
      );
      cy.get('[data-testid="review-comment-input"]', { timeout: 30000 })
        .clear()
        .type(REVIEW_COMMENT, { force: true });
      cy.get('[data-testid="submit-review-button"]', { timeout: 30000 }).click();
      cy.contains('Danh gia cua ban', { timeout: 15000 });

      cy.visit('/activity');
      cy.contains('Lịch sử', { timeout: 30000 }).click();
      cy.get('@customerCompletedBefore').then((beforeValue) => {
        captureLeadingNumber('.MuiCard-root:first-of-type').should('eq', Number(beforeValue) + 1);
      });

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
          'COMPLETED'
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