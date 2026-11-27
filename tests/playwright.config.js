const fs = require('node:fs');
const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}/`;
const localChrome = !process.env.CI
  ? (process.env.CHROME || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined))
  : undefined;

const chromiumLaunchOptions = localChrome
  ? { executablePath: localChrome, args: ['--no-sandbox'] }
  : undefined;

const iphone13 = devices['iPhone 13'];

const projects = [
  {
    name: 'desktop-chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: chromiumLaunchOptions,
    },
  },
  {
    name: 'mobile-chromium',
    use: {
      ...devices['Pixel 7'],
      launchOptions: chromiumLaunchOptions,
    },
  },
  {
    name: 'iphone13-chromium',
    use: {
      browserName: 'chromium',
      viewport: iphone13.viewport,
      deviceScaleFactor: iphone13.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      userAgent: iphone13.userAgent,
      launchOptions: chromiumLaunchOptions,
    },
  },
];

// Optional WebKit (Safari engine) project: enable via PLAYWRIGHT_WEBKIT=1 once host
// WebKit runtime dependencies (e.g. libmanette-0.2-0 on Ubuntu 26.04) are installed.
if (process.env.PLAYWRIGHT_WEBKIT === '1') {
  projects.push({
    name: 'iphone13-webkit',
    use: {
      ...iphone13,
    },
  });
}

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node ../_scripts/serve.mjs ../_site ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 15000,
      },
  projects,
});
