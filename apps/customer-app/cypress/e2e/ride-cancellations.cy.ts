const CUSTOMER_ORIGIN = 'http://127.0.0.1:4000';
const DRIVER_ORIGIN = 'http://127.0.0.1:4001';
const ADMIN_ORIGIN = 'http://127.0.0.1:4002';

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
        url: 'http://127.0.0.1:3000/api/auth/login',
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
        url: 'http://127.0.0.1:3000/api/auth/login',
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
  const API_BASE = 'http://127.0.0.1:3000/api';

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

  it('lets the customer cancel an unassigned CASH ride and shows it in admin', () => {
    loginWithPassword(CUSTOMER_PHONE, '/home');
    loginAdmin();

    createRide().then((rideId) => {
      cy.origin(ADMIN_ORIGIN, { args: { rideId } }, ({ rideId }) => {
        cy.visit('/rides');
        cy.contains('[role="row"]', rideId, { timeout: 30000 }).should('contain.text', 'Đang tìm tài xế');
      });

      cy.visit(`/ride/${rideId}`);
      cy.contains('button', 'Hủy chuyến', { timeout: 30000 }).click();
  cy.contains('Đặt nhầm chuyến', { timeout: 15000 }).click({ force: true });
  cy.contains('button', 'Xác nhận hủy', { timeout: 15000 }).click();

      // After cancel, page stays on ride screen showing CANCELLED receipt
      cy.location('pathname', { timeout: 30000 }).should('match', /^\/ride\//);
      cy.get('[data-testid="back-to-home-btn"]', { timeout: 30000 }).should('be.visible').click();
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

  // ────────────────────────────────────────────────────────────────
  // MoMo refund UX tests (use cy.intercept to mock payment states)
  // ────────────────────────────────────────────────────────────────

  describe('MoMo refund UI states', () => {
    /** Builds a minimal mock Payment object returned by GET /api/payments/ride/:rideId */
    const mockPayment = (rideId: string, overrides: Record<string, unknown> = {}) => ({
      success: true,
      data: {
        payment: {
          id: 'pay-mock-001',
          rideId,
          customerId: 'cust-mock-001',
          amount: 85000,
          method: 'MOMO',
          provider: 'MOMO',
          status: 'COMPLETED',
          transactionId: 'TX_MOMO_12345',
          createdAt: new Date().toISOString(),
          refundedAt: null,
          refund: null,
          ...overrides,
        },
      },
    });

    /** Builds a mock ride response for GET /api/rides/:rideId */
    const mockRide = (rideId: string, status: string, paymentMethod = 'MOMO') => ({
      success: true,
      data: {
        ride: {
          id: rideId,
          customerId: 'cust-mock-001',
          driverId: null,
          status,
          paymentMethod,
          vehicleType: 'CAR_4',
          pickup: { lat: 10.7769, lng: 106.7009, address: 'Bến Thành, Quận 1, TP.HCM' },
          dropoff: { lat: 10.8189, lng: 106.6592, address: 'Tân Sơn Nhất, Tân Bình, TP.HCM' },
          fare: 85000,
          distance: 7.2,
          duration: 900,
          surgeMultiplier: 1,
          requestedAt: new Date().toISOString(),
          cancelledAt: status === 'CANCELLED' ? new Date().toISOString() : null,
          cancelReason: status === 'CANCELLED' ? 'Khách hàng hủy chuyến' : null,
          assignedAt: null,
          acceptedAt: null,
          startedAt: null,
          completedAt: null,
        },
      },
    });

    it('shows pending-refund alert when MoMo ride is CANCELLED but payment still COMPLETED', () => {
      const FAKE_RIDE_ID = 'mock-ride-momo-pending-001';

      // Mock ride endpoint — CANCELLED
      cy.intercept('GET', `**/rides/${FAKE_RIDE_ID}`, mockRide(FAKE_RIDE_ID, 'CANCELLED')).as('getRide');
      // Mock payment endpoint — still COMPLETED (refund in-flight)
      cy.intercept('GET', `**/payments/ride/${FAKE_RIDE_ID}`, mockPayment(FAKE_RIDE_ID, { status: 'COMPLETED' })).as('getPayment');
      // Stub any driver endpoint
      cy.intercept('GET', `**/drivers/*`, { statusCode: 404, body: { success: false } });

      loginWithPassword(CUSTOMER_PHONE, '/home');

      cy.visit(`/ride/${FAKE_RIDE_ID}`);
      cy.wait('@getRide');
      cy.wait('@getPayment');

      // Pending refund alert should be visible
      cy.get('[data-testid="refund-pending-alert"]', { timeout: 15000 }).scrollIntoView().should('be.visible');
      cy.get('[data-testid="refund-pending-alert"]').should('contain.text', 'hoàn tiền');

      // Should NOT navigate away — still on ride screen
      cy.location('pathname').should('eq', `/ride/${FAKE_RIDE_ID}`);

      // Success alert should NOT be present
      cy.get('[data-testid="refund-success-alert"]').should('not.exist');

      // "Quay về trang chủ" button should be visible (CANCELLED state)
      cy.get('[data-testid="back-to-home-btn"]').should('be.visible');
    });

    it('shows refunded-success alert with full details when payment status is REFUNDED', () => {
      const FAKE_RIDE_ID = 'mock-ride-momo-refunded-002';
      const refundedAt = new Date().toISOString();

      // Mock ride — CANCELLED
      cy.intercept('GET', `**/rides/${FAKE_RIDE_ID}`, mockRide(FAKE_RIDE_ID, 'CANCELLED')).as('getRide');

      // Mock payment — REFUNDED with full metadata
      cy.intercept('GET', `**/payments/ride/${FAKE_RIDE_ID}`, mockPayment(FAKE_RIDE_ID, {
        status: 'REFUNDED',
        refundedAt,
        refund: {
          provider: 'MOMO',
          amount: 85000,
          description: 'Hoàn tiền do khách hủy chuyến',
          initiatedAt: refundedAt,
          status: 'success',
          requestId: 'refund_abc123',
          refundOrderId: 'ro_xyz789',
          refundTransactionId: 'MOMO_REFUND_TX_999',
          resultCode: 0,
          message: 'Successful.',
        },
      })).as('getPayment');

      cy.intercept('GET', `**/drivers/*`, { statusCode: 404, body: { success: false } });

      loginWithPassword(CUSTOMER_PHONE, '/home');
      cy.visit(`/ride/${FAKE_RIDE_ID}`);
      cy.wait('@getRide');
      cy.wait('@getPayment');

      // Refund success alert must be visible
      cy.get('[data-testid="refund-success-alert"]', { timeout: 15000 }).scrollIntoView().should('be.visible');
      cy.get('[data-testid="refund-success-alert"]').should('contain.text', 'hoàn tiền');

      // Payment status chip shows "Đã hoàn tiền"
      cy.get('[data-testid="payment-status-chip"]', { timeout: 10000 })
        .scrollIntoView()
        .should('be.visible')
        .should('contain.text', 'Đã hoàn tiền');

      // Pending alert must NOT appear
      cy.get('[data-testid="refund-pending-alert"]').should('not.exist');

      // Should still be on ride page (not auto-redirected)
      cy.location('pathname').should('eq', `/ride/${FAKE_RIDE_ID}`);
    });

    it('shows refund badge "Đã hoàn tiền" on cancelled MoMo ride in ride history page', () => {
      const FAKE_RIDE_ID = 'mock-ride-momo-history-003';
      const refundedAt = new Date().toISOString();

      // Mock rides history endpoint
      cy.intercept('GET', '**/rides/customer/history*', {
        success: true,
        data: {
          rides: [
            {
              id: FAKE_RIDE_ID,
              customerId: 'cust-mock-001',
              driverId: null,
              status: 'CANCELLED',
              paymentMethod: 'MOMO',
              vehicleType: 'CAR_4',
              pickup: { lat: 10.7769, lng: 106.7009, address: 'Bến Thành' },
              dropoff: { lat: 10.8189, lng: 106.6592, address: 'Tân Sơn Nhất' },
              fare: 85000,
              distance: 7.2,
              duration: 900,
              surgeMultiplier: 1,
              requestedAt: new Date(Date.now() - 3600000).toISOString(),
              cancelledAt: refundedAt,
              cancelReason: 'Khách hàng hủy chuyến',
              assignedAt: null,
              acceptedAt: null,
              startedAt: null,
              completedAt: null,
            },
          ],
          total: 1,
        },
      }).as('getRidesHistory');

      // Mock payments history endpoint — REFUNDED
      cy.intercept('GET', '**/payments/customer/history*', {
        success: true,
        data: {
          payments: [
            {
              id: 'pay-mock-hist-001',
              rideId: FAKE_RIDE_ID,
              customerId: 'cust-mock-001',
              amount: 85000,
              method: 'MOMO',
              provider: 'MOMO',
              status: 'REFUNDED',
              transactionId: 'TX_MOMO_12345',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
              refundedAt,
              refund: {
                provider: 'MOMO',
                amount: 85000,
                description: 'Hoàn tiền do khách hủy chuyến',
                requestId: 'refund_abc123',
                refundOrderId: 'ro_xyz789',
                refundTransactionId: 'MOMO_REFUND_TX_999',
                resultCode: 0,
              },
            },
          ],
          total: 1,
        },
      }).as('getPaymentsHistory');

      loginWithPassword(CUSTOMER_PHONE, '/home');
      cy.visit('/history');

      cy.wait('@getRidesHistory');
      cy.wait('@getPaymentsHistory');

      // Refunded badge should appear on the cancelled-MOMO ride card
      cy.get('[data-testid="refund-badge-refunded"]', { timeout: 15000 })
        .should('be.visible')
        .should('contain.text', 'Đã hoàn');

      // Pending badge should NOT be visible for this ride
      cy.get('[data-testid="refund-badge-pending"]').should('not.exist');
    });
  });

});
