import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: false,
    baseUrl: 'http://localhost:4000',
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
    video: false,
    screenshotOnRunFailure: true,
  },
  chromeWebSecurity: false,
});