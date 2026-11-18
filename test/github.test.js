import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOpenReviews,
  formatAge,
  GitHubQueueError,
  initialsFor,
  mapPullRequest,
  riskFor,
  summarizeBody,
} from '../src/github.js';

const basePr = {
  number: 12,
  title: 'Add live queue data',
  body: 'Reads open pull requests and keeps decisions local.',
  html_url: 'https://github.com/redsumex/openreview/pull/12',
  draft: false,
  labels: [{ name: 'frontend' }],
  user: { login: 'northstar-labs' },
  head: { ref: 'feat/live-queue' },
  base: { ref: 'main', repo: { full_name: 'redsumex/openreview' } },
  created_at: '2026-11-18T09:00:00Z',
};

function response(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  };
}

test('maps a GitHub pull request into the queue model', () => {
  const review = mapPullRequest(basePr, {
    additions: 42,
    deletions: 8,
    changed_files: 3,
  }, { now: new Date('2026-11-18T10:00:00Z').getTime() });

  assert.equal(review.id, 'gh-redsumex-openreview-12');
  assert.equal(review.number, 12);
  assert.equal(review.author, 'northstar-labs');
  assert.equal(review.initials, 'NL');
  assert.equal(review.branch, 'feat/live-queue');
  assert.equal(review.files, 3);
  assert.equal(review.additions, 42);
  assert.equal(review.deletions, 8);
  assert.equal(review.age, '1h');
  assert.equal(review.ageMinutes, 60);
  assert.equal(review.checks, 'unknown');
  assert.equal(review.coverage, '-');
  assert.equal(review.url, basePr.html_url);
  assert.equal(review.source, 'github');
  assert.equal(review.findings.length, 0);
});

test('keeps cards useful when detail requests fail', () => {
  const review = mapPullRequest(basePr, null, {
    now: new Date('2026-11-18T10:00:00Z').getTime(),
  });
  assert.equal(review.files, null);
  assert.equal(review.additions, null);
  assert.equal(review.deletions, null);
  assert.equal(review.title, basePr.title);
});

test('derives risk and age labels', () => {
  assert.equal(riskFor({ additions: 5, deletions: 2 }), 'low');
  assert.equal(riskFor({ draft: true, additions: 5, deletions: 2 }), 'medium');
  assert.equal(riskFor({ additions: 300, deletions: 150 }), 'high');
  assert.equal(formatAge(0), '1m');
  assert.equal(formatAge(12), '12m');
  assert.equal(formatAge(90), '1h');
  assert.equal(formatAge(1_500), '1d');
  assert.equal(initialsFor('dependabot[bot]'), 'DE');
  assert.equal(initialsFor('mira.builds'), 'MB');
  assert.match(summarizeBody('<!-- hidden --> **Hello**\n\nworld'), /Hello world/);
});

test('fetches open pull requests and their detail rows', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/pulls?')) return response([basePr]);
    return response({ ...basePr, additions: 9, deletions: 1, changed_files: 2 });
  };

  const reviews = await fetchOpenReviews({
    fetchImpl,
    now: new Date('2026-11-18T10:00:00Z').getTime(),
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0], /state=open/);
  assert.match(calls[1], /\/pulls\/12$/);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].files, 2);
});

test('returns an empty queue when the repository has no open pull requests', async () => {
  const reviews = await fetchOpenReviews({
    fetchImpl: async () => response([]),
  });
  assert.deepEqual(reviews, []);
});

test('surfaces GitHub rate limits as a typed error', async () => {
  await assert.rejects(
    () => fetchOpenReviews({
      fetchImpl: async () => response({ message: 'API rate limit exceeded' }, {
        status: 403,
        headers: { 'x-ratelimit-reset': '1700000000' },
      }),
    }),
    (error) => error instanceof GitHubQueueError && error.status === 403 && /rate limit/i.test(error.message),
  );
});
