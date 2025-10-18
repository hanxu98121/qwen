import { test, expect } from '@playwright/test';

test('Debug MIME type issue', async ({ page }) => {
  // Monitor network requests
  const requests: any[] = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
  });

  page.on('response', response => {
    const request = response.request();
    requests.push({
      url: request.url(),
      status: response.status(),
      contentType: response.headers()['content-type'],
      headers: response.headers()
    });
  });

  // Navigate to the site
  await page.goto('https://qwen-cyan.vercel.app/', {
    waitUntil: 'networkidle'
  });

  // Wait a bit for all requests to complete
  await page.waitForTimeout(3000);

  console.log('=== Network Requests Analysis ===');

  // Find the JavaScript file request
  const jsRequest = requests.find(req =>
    req.url.includes('index-B6Vig_4b.js') && req.status !== undefined
  );

  if (jsRequest) {
    console.log('JavaScript File Request Details:');
    console.log(`URL: ${jsRequest.url}`);
    console.log(`Status: ${jsRequest.status}`);
    console.log(`Content-Type: ${jsRequest.contentType}`);
    console.log(`Headers:`, jsRequest.headers);

    // Check if it's actually returning HTML
    const isHtmlContent = jsRequest.contentType?.includes('text/html') ||
                          jsRequest.headers['content-disposition']?.includes('filename="index.html"');

    console.log(`Is serving HTML instead of JS: ${isHtmlContent}`);
  } else {
    console.log('JavaScript file request not found in the captured requests');
  }

  // List all requests to /assets/
  const assetRequests = requests.filter(req =>
    req.url.includes('/assets/') && req.status !== undefined
  );

  console.log('\n=== All Asset Requests ===');
  assetRequests.forEach(req => {
    console.log(`${req.status} ${req.url} (${req.contentType})`);
  });

  // Check what the #root element contains
  const rootContent = await page.locator('#root').innerHTML();
  console.log(`\nRoot element content: "${rootContent}"`);
  console.log(`Root element is empty: ${rootContent.trim().length === 0}`);

  // Take screenshot for documentation
  await page.screenshot({
    path: 'test-results/debug-mime-issue.png',
    fullPage: true
  });
});