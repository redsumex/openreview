import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = 4188;

test('serves the OpenReview page and its assets', async (t) => {
  const server = spawn(process.execPath, ['server.mjs'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());

  let startupTimer;
  const startupTimeout = new Promise((_, reject) => {
    startupTimer = setTimeout(() => reject(new Error('server did not start')), 5_000);
  });
  try {
    await Promise.race([once(server.stdout, 'data'), startupTimeout]);
  } finally {
    clearTimeout(startupTimer);
  }

  const base = `http://127.0.0.1:${port}`;
  let page;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      page = await fetch(`${base}/`);
      break;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const html = await page.text();
  const app = await fetch(`${base}/src/app.js`);
  const mark = await fetch(`${base}/assets/mark.svg`);

  assert.equal(page.status, 200);
  assert.equal(app.status, 200);
  assert.equal(mark.status, 200);
  assert.match(html, /<title>OpenReview - Code review that stays in the open<\/title>/);
  assert.match(html, /src\/app\.js/);
  assert.match(await app.text(), /function openReview/);
  assert.match(await mark.text(), /OpenReview mark/);
});
