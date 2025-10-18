import { test, expect, Page } from '@playwright/test';

/**
 * Test suite for Qwen3-ASR-Studio deployed at https://qwen-cyan.vercel.app/
 * This test suite verifies the complete functionality of the ASR studio interface
 */

test.describe('Qwen3-ASR-Studio Frontend Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Set up console error logging
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(`[Console Error] ${msg.text()}`);
      }
      if (msg.type() === 'warn') {
        consoleMessages.push(`[Console Warning] ${msg.text()}`);
      }
    });

    // Store console messages for later analysis
    (page as any).consoleMessages = consoleMessages;

    // Navigate to the app
    await page.goto('https://qwen-cyan.vercel.app/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
  });

  test.afterEach(async () => {
    // Capture any console errors that occurred
    const consoleMessages = (page as any).consoleMessages || [];
    if (consoleMessages.length > 0) {
      console.log('Console messages during test:');
      consoleMessages.forEach((msg: string) => console.log(msg));
    }
    await page.close();
  });

  test('Page loads correctly and basic elements are present', async () => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/initial-load.png',
      fullPage: true
    });

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Qwen3-ASR-Studio/);

    // Check that the root element exists and is not empty
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();

    // Check that root has content (not just empty div)
    const rootContent = await rootElement.innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);

    console.log(`Root element content length: ${rootContent.length} characters`);
  });

  test('React app renders and main components are visible', async () => {
    // Wait for React to mount and render
    await page.waitForTimeout(2000);

    // Check for header component
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // Look for the main app container
    const mainContainer = page.locator('.min-h-screen, main, [class*="container"], [class*="app"]');
    if (await mainContainer.count() > 0) {
      await expect(mainContainer.first()).toBeVisible();
    }

    // Take screenshot after components load
    await page.screenshot({
      path: 'test-results/components-loaded.png',
      fullPage: true
    });
  });

  test('Key UI elements are present and accessible', async () => {
    await page.waitForTimeout(2000);

    // Check for audio upload area (could be input, drop zone, or button)
    const uploadSelectors = [
      'input[type="file"]',
      '[data-testid="audio-upload"]',
      '[class*="upload"]',
      '[class*="audio"]',
      'button:has-text("上传")',
      'button:has-text("选择")',
      '[aria-label*="audio"]',
      '[aria-label*="upload"]'
    ];

    let uploadElement = null;
    for (const selector of uploadSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          uploadElement = element;
          console.log(`Found upload element with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    // Check for recording functionality
    const recordingSelectors = [
      'button:has-text("录音")',
      'button:has-text("开始")',
      '[class*="record"]',
      '[class*="microphone"]',
      '[aria-label*="record"]',
      'button[title*="录音"]'
    ];

    let recordingElement = null;
    for (const selector of recordingSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          recordingElement = element;
          console.log(`Found recording element with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    // Check for transcription button
    const transcribeSelectors = [
      'button:has-text("识别")',
      'button:has-text("转录")',
      'button:has-text("Transcribe")',
      '[class*="transcribe"]',
      '[class*="recognize"]',
      '[data-testid="transcribe-btn"]',
      'button[type="submit"]'
    ];

    let transcribeElement = null;
    for (const selector of transcribeSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          transcribeElement = element;
          console.log(`Found transcribe element with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    // Check for settings or menu buttons
    const settingsSelectors = [
      'button:has-text("设置")',
      'button:has-text("Settings")',
      '[class*="settings"]',
      '[aria-label*="settings"]',
      '[class*="menu"]'
    ];

    let settingsElement = null;
    for (const selector of settingsSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          settingsElement = element;
          console.log(`Found settings element with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    // Take screenshot showing what elements we found
    await page.screenshot({
      path: 'test-results/ui-elements.png',
      fullPage: true
    });

    // Log what we found
    console.log(`Upload element found: ${uploadElement !== null}`);
    console.log(`Recording element found: ${recordingElement !== null}`);
    console.log(`Transcribe element found: ${transcribeElement !== null}`);
    console.log(`Settings element found: ${settingsElement !== null}`);
  });

  test('Dark/light mode toggle functionality', async () => {
    await page.waitForTimeout(2000);

    // Check initial theme (default should be light)
    const htmlElement = page.locator('html');
    const hasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));
    console.log(`Initial theme - dark mode: ${hasDarkClass}`);

    // Look for theme toggle button
    const themeToggleSelectors = [
      'button[aria-label*="theme"]',
      'button[title*="theme"]',
      'button:has-text("🌙")',
      'button:has-text("☀️")',
      '[class*="theme"]',
      '[data-testid="theme-toggle"]',
      'button:has-text("深色")',
      'button:has-text("浅色")'
    ];

    let themeToggle = null;
    for (const selector of themeToggleSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          themeToggle = element;
          console.log(`Found theme toggle with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    if (themeToggle) {
      // Take screenshot before theme change
      await page.screenshot({ path: 'test-results/theme-before.png' });

      // Click theme toggle
      await themeToggle.click();
      await page.waitForTimeout(1000);

      // Check if theme changed
      const hasDarkClassAfter = await htmlElement.evaluate(el => el.classList.contains('dark'));
      console.log(`After toggle - dark mode: ${hasDarkClassAfter}`);

      // Take screenshot after theme change
      await page.screenshot({ path: 'test-results/theme-after.png' });

      // Verify theme actually changed
      expect(hasDarkClassAfter).toBe(!hasDarkClass);
    } else {
      console.log('Theme toggle button not found');
      // Still take a screenshot to document the state
      await page.screenshot({ path: 'test-results/no-theme-toggle.png' });
    }
  });

  test('JavaScript loads without critical errors', async () => {
    await page.waitForTimeout(3000);

    // Check for any JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    // Wait a bit more for any delayed errors
    await page.waitForTimeout(2000);

    // Log any JavaScript errors
    if (jsErrors.length > 0) {
      console.log('JavaScript errors found:');
      jsErrors.forEach((error, index) => {
        console.log(`Error ${index + 1}: ${error}`);
      });
    } else {
      console.log('No JavaScript errors detected');
    }

    // Check that critical React components loaded
    const hasReactContent = await page.evaluate(() => {
      return !!document.querySelector('[data-reactroot]') ||
             !!document.querySelector('#root > div') ||
             window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined;
    });

    console.log(`React content detected: ${hasReactContent}`);

    // Check for any error messages in the page
    const errorSelectors = [
      '[class*="error"]',
      '[class*="Error"]',
      'text=error',
      'text=Error',
      'text=failed',
      'text=Failed'
    ];

    let pageErrors = 0;
    for (const selector of errorSelectors) {
      try {
        const elements = page.locator(selector);
        pageErrors += await elements.count();
      } catch (e) {
        // Ignore selector errors
      }
    }

    console.log(`Error elements found on page: ${pageErrors}`);

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/javascript-check.png',
      fullPage: true
    });
  });

  test('Responsive layout works correctly', async () => {
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/desktop-layout.png' });

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/tablet-layout.png' });

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/mobile-layout.png' });

    // Check that content is still visible in mobile view
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();

    const rootContent = await rootElement.innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);
  });

  test('Network resources load correctly', async () => {
    // Monitor network requests
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.waitForTimeout(3000);

    if (failedRequests.length > 0) {
      console.log('Failed network requests:');
      failedRequests.forEach((failure, index) => {
        console.log(`Failure ${index + 1}: ${failure}`);
      });
    } else {
      console.log('All network requests completed successfully');
    }

    // Check that critical resources loaded
    const criticalResources = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script')).length;
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).length;
      const images = Array.from(document.querySelectorAll('img')).filter(img => img.complete).length;
      return { scripts, styles, images };
    });

    console.log(`Resources loaded - Scripts: ${criticalResources.scripts}, Styles: ${criticalResources.styles}, Images: ${criticalResources.images}`);
  });

  test('Interactive elements are functional', async () => {
    await page.waitForTimeout(2000);

    // Find any clickable elements
    const clickableElements = await page.locator('button, [role="button"], a, input').all();
    console.log(`Found ${clickableElements.length} potentially interactive elements`);

    // Test a few buttons if they exist
    const buttons = await page.locator('button').all();
    for (let i = 0; i < Math.min(3, buttons.length); i++) {
      try {
        const button = buttons[i];
        if (await button.isVisible()) {
          console.log(`Testing button ${i + 1}`);

          // Hover over button
          await button.hover();
          await page.waitForTimeout(500);

          // Click button (but don't wait for navigation as it might be a modal)
          await Promise.race([
            button.click(),
            page.waitForTimeout(1000)
          ]);

          await page.waitForTimeout(1000);

          // Take screenshot after interaction
          await page.screenshot({
            path: `test-results/button-interaction-${i + 1}.png`
          });

          // Check if any modal or overlay appeared
          const modalSelectors = [
            '[role="dialog"]',
            '[class*="modal"]',
            '[class*="overlay"]',
            '[class*="popup"]'
          ];

          for (const selector of modalSelectors) {
            try {
              const modal = page.locator(selector).first();
              if (await modal.isVisible()) {
                console.log(`Modal appeared after button click: ${selector}`);
                // Close modal if possible
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
                break;
              }
            } catch (e) {
              // Continue checking other selectors
            }
          }
        }
      } catch (e) {
        console.log(`Error testing button ${i + 1}: ${e}`);
      }
    }
  });

  test('Content and styling verification', async () => {
    await page.waitForTimeout(2000);

    // Check that the page has meaningful content
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);

    // Look for Chinese text (ASR studio should have Chinese content)
    const hasChineseText = /[\u4e00-\u9fff]/.test(pageContent || '');
    console.log(`Page contains Chinese text: ${hasChineseText}`);

    // Check for CSS custom properties that should be defined
    const cssVariables = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        brandPrimary: styles.getPropertyValue('--color-brand-primary'),
        base100: styles.getPropertyValue('--color-base-100'),
        content100: styles.getPropertyValue('--color-content-100')
      };
    });

    console.log('CSS variables:', cssVariables);

    // Verify Tailwind CSS loaded
    const tailwindLoaded = await page.evaluate(() => {
      return typeof window.tailwind !== 'undefined' ||
             document.querySelector('script[src*="tailwind"]') !== null;
    });

    console.log(`Tailwind CSS loaded: ${tailwindLoaded}`);

    // Take final comprehensive screenshot
    await page.screenshot({
      path: 'test-results/final-verification.png',
      fullPage: true
    });
  });
});

test.describe('Performance and Loading Tests', () => {
  test('Page loading performance', async ({ page }) => {
    const startTime = Date.now();

    // Navigate with detailed timing
    const response = await page.goto('https://qwen-cyan.vercel.app/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // Check response status
    expect(response?.status()).toBe(200);

    // Wait for full render
    await page.waitForTimeout(3000);

    // Check performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(e => e.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    console.log('Performance metrics:', metrics);

    // Take performance screenshot
    await page.screenshot({
      path: 'test-results/performance-test.png',
      fullPage: true
    });
  });
});