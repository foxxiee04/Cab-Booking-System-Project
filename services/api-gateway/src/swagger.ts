import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cab Booking System API',
      version: '1.0.0',
      description: `
## Hệ Thống Đặt Xe Trực Tuyến - API Documentation

### Tổng Quan
Cab Booking System là nền tảng đặt xe trực tuyến sử dụng kiến trúc Microservices với các tính năng:
- 🔐 Xác thực JWT
- 🚗 Quản lý tài xế và xe
- 📍 Định vị GPS thời gian thực
- 💳 Thanh toán đa phương thức
- 📊 Thống kê và báo cáo
- 🔔 WebSocket real-time updates

### Authentication
Hầu hết các endpoints yêu cầu JWT token trong header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

Login để lấy token tại \`POST /api/auth/login\`

### Base URL
- **Development**: \`http://localhost:3000\`
- **Production**: \`https://api.yourdomain.com\`

### Microservices Architecture
- **API Gateway**: Port 3000 (proxy tất cả requests)
- **Auth Service**: Port 3001 (authentication & authorization)
- **User Service**: Port 3002 (customer profiles)
- **Driver Service**: Port 3003 (driver management)
- **Booking Service**: Port 3004 (booking creation)
- **Ride Service**: Port 3005 (ride lifecycle)
- **Payment Service**: Port 3006 (payment processing)
- **Pricing Service**: Port 3007 (fare calculation)
- **Notification Service**: Port 3008 (SMS/email notifications)
- **Review Service**: Port 3009 (ratings & reviews)

### Response Format
All responses follow this structure:
\`\`\`json
{
  "success": true|false,
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
\`\`\`

### Rate Limiting
- **General**: 100 requests/15 minutes
- **Auth**: 5 requests/15 minutes
- **Payments**: 20 requests/15 minutes

### WebSocket
Connect to  \`ws://localhost:3000\` with JWT for real-time updates:
- \`NEW_RIDE_AVAILABLE\` (driver)
- \`RIDE_STATUS_UPDATE\` (customer & driver)
- \`RIDE_COMPLETED\` (customer & driver)
      `,
      contact: {
        name: 'KLTN2025 Team',
        email: 'support@cabsystem.vn',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.cabsystem.vn',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data',
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            role: {
              type: 'string',
              enum: ['CUSTOMER', 'DRIVER', 'ADMIN'],
              example: 'CUSTOMER',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-02-08T10:30:00.000Z',
            },
          },
        },
        Driver: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            vehicleModel: {
              type: 'string',
              example: 'Toyota Vios 2020',
            },
            vehiclePlate: {
              type: 'string',
              example: '30A-12345',
            },
            licenseNumber: {
              type: 'string',
              example: '012345678',
            },
            rating: {
              type: 'number',
              format: 'float',
              example: 4.8,
            },
            availabilityStatus: {
              type: 'string',
              enum: ['ONLINE', 'OFFLINE', 'BUSY'],
              example: 'ONLINE',
            },
          },
        },
        Ride: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            customerId: {
              type: 'string',
              format: 'uuid',
            },
            driverId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            pickupAddress: {
              type: 'string',
              example: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
            },
            dropoffAddress: {
              type: 'string',
              example: 'Số 100 Nguyễn Văn Cừ, Long Biên, Hà Nội',
            },
            fare: {
              type: 'number',
              example: 206800,
            },
            distance: {
              type: 'number',
              example: 6.2,
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
              example: 'PENDING',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            rideId: {
              type: 'string',
              format: 'uuid',
            },
            amount: {
              type: 'number',
              example: 206800,
            },
            method: {
              type: 'string',
              enum: ['CASH', 'CARD', 'WALLET'],
              example: 'CASH',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'COMPLETED', 'FAILED'],
              example: 'COMPLETED',
            },
            paidAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'Customer profile management',
      },
      {
        name: 'Drivers',
        description: 'Driver management and availability',
      },
      {
        name: 'Bookings',
        description: 'Booking creation and management',
      },
      {
        name: 'Rides',
        description: 'Ride lifecycle management',
      },
      {
        name: 'Payments',
        description: 'Payment processing',
      },
      {
        name: 'Pricing',
        description: 'Fare estimation',
      },
      {
        name: 'Admin',
        description: 'Admin dashboard and statistics',
      },
      {
        name: 'Health',
        description: 'Service health checks',
      },
    ],
  },
  // Path to API docs (use glob pattern)
  apis: ['./src/routes/*.ts', './src/index.ts', './dist/routes/*.js', './dist/index.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
