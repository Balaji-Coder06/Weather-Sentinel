import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runE2ETests() {
  console.log('\n--- STARTING LIVE HEADLESS CHROME E2E VERIFICATION ---');
  let browser;
  let passed = 0;
  let failed = 0;

  const test = (name, cond) => {
    if (cond) {
      passed++;
      console.log(`  ✓ PASS: ${name}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${name}`);
    }
  };

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log('Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });

    test('Page title and header loaded', (await page.$('.hero-section')) !== null);
    test('Brand badge present', (await page.$('.brand-badge')) !== null);
    test('Open-Meteo live feed indicator active', (await page.$('.pulse-indicator.live')) !== null);

    // Test Planner Form
    const submitBtn = await page.$('#analyze-conditions-btn');
    test('Evaluate button present', submitBtn !== null);
    
    console.log('Submitting activity plan for Chennai...');
    await submitBtn.click();

    // Wait for analysis result
    await page.waitForSelector('.analysis-view-wrapper', { timeout: 15000 });
    test('Analysis view successfully rendered', (await page.$('.analysis-view-wrapper')) !== null);

    // Verify Risk Score Gauge
    const scoreVal = await page.$eval('.gauge-score-value', (el) => el.textContent.trim());
    test(`Radial risk score computed (${scoreVal})`, scoreVal.length > 0 && !isNaN(parseInt(scoreVal, 10)));

    // Verify Primary Driver
    const primaryDriverEl = await page.$('.driver-value');
    test('Primary driver computed and displayed', primaryDriverEl !== null);

    // Verify Contributing Factors Accordions
    const factors = await page.$$('.factor-interactive-card');
    test(`5 environmental stress vectors rendered (got ${factors.length})`, factors.length >= 5);

    // Test Optimal Window Card
    const bestTimeCard = await page.$('.best-time-card');
    test('Optimal window card rendered', bestTimeCard !== null);

    // Test Timeline Forecast Curve
    const timelineSvg = await page.$('.risk-curve-svg');
    test('Hourly continuous forecast risk curve SVG rendered', timelineSvg !== null);

    // Verify console errors
    test('Zero browser console errors during full execution', errors.length === 0);

    console.log('\n======================================================');
    console.log(`E2E SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('E2E Execution failed:', err);
    failed++;
  } finally {
    if (browser) await browser.close();
  }

  if (failed > 0) process.exit(1);
}

runE2ETests();
