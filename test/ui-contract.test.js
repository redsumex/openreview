import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('uses the OpenReview mark in the favicon and page', () => {
  const mark = read('../assets/mark.svg');
  const page = read('../index.html');

  assert.match(mark, /aria-label="OpenReview mark"/);
  assert.match(mark, /#f87171/);
  assert.match(page, /OpenReview - Code review/);
  assert.doesNotMatch(page, /Creditster/);
});

test('renders a review queue with a detail dialog and three decisions', () => {
  const app = read('../src/app.js');

  assert.match(app, /data-review-id/);
  assert.match(app, /data-decision/);
  assert.match(app, /function openReview/);
  assert.match(app, /function handleDecision/);
  assert.match(app, /reviewDialogBody\.dataset\.reviewId = review\.id/);
  assert.match(app, /fetchOpenReviews/);
  assert.match(app, /queue-notice/);
  assert.match(app, /data-github-link/);
});

test('keeps the public and app surfaces separate', () => {
  const page = read('../index.html');

  assert.match(page, /id="public-view"/);
  assert.match(page, /id="app-view"[^>]*hidden/);
  assert.match(page, /id="review-dialog"/);
});
