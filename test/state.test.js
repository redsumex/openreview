import test from 'node:test';
import assert from 'node:assert/strict';
import { reviews } from '../src/data.js';
import {
  createInitialState,
  filterReviews,
  recordReview,
  statusFor,
  summarizeReviews,
  validateEmail,
} from '../src/state.js';

test('validates a usable email and rejects malformed values', () => {
  assert.equal(validateEmail('reviewer@example.com'), '');
  assert.match(validateEmail('not-an-email'), /valid email/);
  assert.match(validateEmail(''), /Enter your email/);
});

test('filters reviews by query and status', () => {
  const matching = filterReviews(reviews, { query: 'mobile', status: 'all' });
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'or-207');

  const approved = filterReviews(reviews, {
    status: 'approved',
    decisions: { 'or-207': { decision: 'approved' } },
  });
  assert.deepEqual(approved.map((review) => review.id), ['or-207']);
});

test('sorts by priority, size, and age', () => {
  const priority = filterReviews(reviews, { sort: 'priority' });
  assert.equal(priority[0].risk, 'high');

  const smallest = filterReviews(reviews, { sort: 'smallest' });
  assert.equal(smallest[0].files, 2);

  const oldest = filterReviews(reviews, { sort: 'oldest' });
  assert.equal(oldest[0].ageMinutes, 300);
});

test('summarizes queue status from explicit decisions', () => {
  const initial = summarizeReviews(reviews);
  assert.equal(initial.open, 6);
  assert.equal(initial.needsReview, 6);
  assert.equal(initial.approved, 0);

  const reviewed = summarizeReviews(reviews, {
    'or-208': { decision: 'changes-requested' },
    'or-207': { decision: 'approved' },
  });
  assert.equal(reviewed.needsReview, 4);
  assert.equal(reviewed.changesRequested, 1);
  assert.equal(reviewed.approved, 1);
  assert.equal(reviewed.open, 5);
});

test('records a decision without mutating the original state', () => {
  const initial = createInitialState();
  const next = recordReview(initial, 'or-208', 'approved', 'Verified the fallback path.');
  assert.equal(statusFor(reviews[0], initial.decisions), 'needs-review');
  assert.equal(statusFor(reviews[0], next.decisions), 'approved');
  assert.equal(next.decisions['or-208'].note, 'Verified the fallback path.');
  assert.equal(next.activity.length, 1);
  assert.equal(initial.activity.length, 0);
});

test('a comment does not change the review status', () => {
  const initial = createInitialState();
  const next = recordReview(initial, 'or-208', 'comment', 'One question.');
  assert.equal(statusFor(reviews[0], next.decisions), 'needs-review');
});
