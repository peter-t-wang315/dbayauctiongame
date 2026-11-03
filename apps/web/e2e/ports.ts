// Single source for e2e ports. Override with E2E_WEB_PORT / E2E_MOCK_PORT (defaults match CI).
export const WEB_PORT = process.env.E2E_WEB_PORT ?? '3100';
export const MOCK_PORT = process.env.E2E_MOCK_PORT ?? '8787';
