// Hermes fallback smoke test.
export const STORAGE_KEY = 'openreview-demo-v1';

export function createInitialState() {
  return {
    user: null,
    decisions: {},
    activity: [],
    theme: 'light',
  };
}

export function validateEmail(value) {
  const email = String(value || '').trim();
  if (!email) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return '';
}

export function statusFor(review, decisions = {}) {
  const decision = decisions[review.id]?.decision;
  if (decision === 'comment') return review.status || 'needs-review';
  return decision || review.status || 'needs-review';
}

export function filterReviews(reviews, {
  query = '',
  status = 'all',
  sort = 'priority',
  decisions = {},
} = {}) {
  const needle = String(query).trim().toLowerCase();
  const filtered = reviews.filter((review) => {
    const reviewStatus = statusFor(review, decisions);
    const matchesStatus = status === 'all' || reviewStatus === status;
    const haystack = [
      review.title,
      review.repo,
      review.author,
      review.branch,
      ...review.labels,
    ].join(' ').toLowerCase();
    return matchesStatus && (!needle || haystack.includes(needle));
  });

  return [...filtered].sort((a, b) => {
    if (sort === 'oldest') return b.ageMinutes - a.ageMinutes;
    if (sort === 'smallest') return a.files - b.files;
    return b.priority - a.priority || b.files - a.files;
  });
}

export function summarizeReviews(reviews, decisions = {}) {
  const counts = { 'needs-review': 0, 'changes-requested': 0, approved: 0 };
  for (const review of reviews) {
    counts[statusFor(review, decisions)] += 1;
  }
  return {
    total: reviews.length,
    needsReview: counts['needs-review'],
    changesRequested: counts['changes-requested'],
    approved: counts.approved,
    open: reviews.length - counts.approved,
  };
}

export function recordReview(state, reviewId, decision, note = '') {
  return {
    ...state,
    decisions: {
      ...state.decisions,
      [reviewId]: {
        decision,
        note: String(note || '').trim(),
        at: new Date().toISOString(),
      },
    },
    activity: [
      {
        type: decision,
        reviewId,
        at: 'just now',
      },
      ...state.activity,
    ].slice(0, 8),
  };
}
