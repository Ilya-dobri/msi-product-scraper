const { chromium, errors } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const productUrl = 'https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI';

function toNumber(text) {
  if (!text || !text.trim()) return null;
  const value = Number(text.trim());
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const browser = await chromium.launch({ headless: false });

  try {
    const page = await browser.newPage();
    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });

    const titleElement = page.locator('h2.title.crop-text-2');
    await titleElement.waitFor({ state: 'visible', timeout: 30000 });
    const title = (await titleElement.innerText()).trim() || null;

    const priceElement = page.locator('#prices-new');
    await priceElement.waitFor({ state: 'visible', timeout: 30000 });
    const priceText = await priceElement.innerText();
    const price = toNumber(priceText.replace('$', '').replaceAll(',', '').trim());

    const ratingElement = page.locator('#average-rating-info').first();
    let starRating = null;
    let reviewCount = null;

    try {
      await page.waitForFunction(() => {
        const element = document.querySelector('#average-rating-info');
        return element && /\d/.test(element.textContent);
      }, null, { timeout: 15000 });

      const ratingText = await ratingElement.innerText({ timeout: 5000 });
      const [rating, reviews] = ratingText.split('(');
      starRating = toNumber(rating);

      if (reviews) {
        reviewCount = toNumber(reviews.replace(')', '').replaceAll(',', ''));
      }
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) throw error;
      console.warn('Не удалось дождаться текста рейтинга.');
    }

    const product = {
      url: page.url(),
      item_id: null,
      title,
      brand: null,
      product_category: null,
      category_tree: [],
      description: null,
      price,
      sale_price: null,
      availability: null,
      image_url: null,
      additional_image_urls: [],
      specs: [],
      star_rating: starRating,
      review_count: reviewCount,
      gtin: null,
      mpn: null,
      scraped_at: new Date().toISOString(),
    };

    const outputDir = path.join(__dirname, '..', 'output');
    const outputPath = path.join(outputDir, 'product.json');

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify(product, null, 2) + '\n', 'utf8');

    console.log(product);
    console.log('Сохранено:', outputPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Ошибка:', error.message);
  process.exitCode = 1;
});