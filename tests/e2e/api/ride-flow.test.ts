import axios, { AxiosInstance } from 'axios';

const API_GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:3000';

describe('API Integration Tests - Ride Flow', () => {
  let api: AxiosInstance;
  let customerToken: string;
  let driverToken: string;
  let rideId: string;

  beforeAll(async () => {
    api = axios.create({
      baseURL: API_GATEWAY,
      timeout: 10000,
    });
  });

  describe('Authentication', () => {
    it('should register a new customer', async () => {
      const response = await api.post('/auth/register', {
        email: `customer-${Date.now()}@test.com`,
        password: 'Test123!@#',
        name: 'Test Customer',
        role: 'CUSTOMER',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
    });

    it('should login customer', async () => {
      const response = await api.post('/auth/login', {
        email: 'customer@test.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
      customerToken = response.data.accessToken;
    });

    it('should login driver', async () => {
      const response = await api.post('/auth/login', {
        email: 'driver@test.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      driverToken = response.data.accessToken;
    });
  });

  describe('Ride Booking Flow', () => {
    it('customer should create a ride request', async () => {
      const response = await api.post(
        '/rides',
        {
          pickupLocation: {
            lat: 10.762622,
            lng: 106.660172,
            address: '123 Main St, HCMC',
          },
          destination: {
            lat: 10.772622,
            lng: 106.670172,
            address: '456 Oak Ave, HCMC',
          },
        },
        {
          headers: { Authorization: `Bearer ${customerToken}` },
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.status).toBe('PENDING');
      rideId = response.data.id;
    });

    it('driver should accept ride', async () => {
      const response = await api.post(
        `/rides/${rideId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${driverToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ACCEPTED');
    });

    it('driver should start ride', async () => {
      const response = await api.post(
        `/rides/${rideId}/start`,
        {},
        {
          headers: { Authorization: `Bearer ${driverToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('IN_PROGRESS');
    });

    it('driver should complete ride', async () => {
      const response = await api.post(
        `/rides/${rideId}/complete`,
        {
          endLocation: {
            lat: 10.772622,
            lng: 106.670172,
          },
          actualDistance: 1.5,
        },
        {
          headers: { Authorization: `Bearer ${driverToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('COMPLETED');
      expect(response.data).toHaveProperty('fare');
    });

    it('customer should view ride history', async () => {
      const response = await api.get('/rides/my-rides', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unauthorized requests', async () => {
      try {
        await api.get('/rides/my-rides');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should return 400 for invalid ride request', async () => {
      try {
        await api.post(
          '/rides',
          {
            pickupLocation: { lat: 'invalid' },
          },
          {
            headers: { Authorization: `Bearer ${customerToken}` },
          }
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });
});
