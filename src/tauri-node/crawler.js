#!/usr/bin/env node
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const argv = require('minimist')(process.argv.slice(2));

const url = argv.url;
const type = argv.type || 'chapter';
const stream = argv.stream || false;

if (!url) {
  console.error('Missing --url');
  process.exit(2);
}

function emit(obj) {
  console.log(JSON.stringify(obj));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    emit({ event: 'started', url, type });
    // example progress ticks (for demo)
    if (stream) emit({ event: 'progress', percent: 5 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (stream) emit({ event: 'progress', percent: 50 });
    const content = await page.content();
    const $ = cheerio.load(content);

    if (type === 'metadata') {
      const title = $('h1').first().text().trim() || '';
      const author = $('.author').first().text().trim() || '';
      const summary = $('.summary').first().text().trim() || '';
      emit({ event: 'result', payload: { title, author, summary } });
    } else {
      const title =
        $('h1').first().text().trim() || $('title').text().trim() || '';
      const contentHtml =
        $('#content').html() ||
        $('.chapter-content').html() ||
        $('.read-content').html() ||
        $('body').html() ||
        '';
      emit({ event: 'result', payload: { title, content: contentHtml } });
    }
    if (stream) emit({ event: 'progress', percent: 100 });
    emit({ event: 'done' });
  } catch (e) {
    emit({ event: 'error', message: String(e) });
    process.exit(1);
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
})();
