import fs from 'fs';
import path from 'path';
import { swaggerSpec } from '../swagger';

const spec = swaggerSpec as any;

describe('API Gateway Swagger', () => {
  it('should expose core OpenAPI metadata and bearer auth', () => {
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info).toEqual(
      expect.objectContaining({
        title: 'Cab Booking System API',
        version: '1.0.0',
      })
    );
    expect(spec.components?.securitySchemes?.bearerAuth).toEqual(
      expect.objectContaining({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      })
    );
    expect(spec.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'http://localhost:3000' }),
        expect.objectContaining({ url: 'https://api.cabsystem.vn' }),
      ])
    );
  });

  it('should expose a valid OpenAPI paths object', () => {
    expect(spec.paths).toEqual(expect.any(Object));
  });

  it('should mount swagger UI on /api-docs in the app factory', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.ts'), 'utf8');

    expect(appSource).toContain("app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec");
    expect(appSource).toContain("customSiteTitle: 'Cab Booking System API'");
  });
});