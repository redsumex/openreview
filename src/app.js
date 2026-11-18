import {
  activitySeed,
  reviews,
  riskLabels,
  statusLabels,
} from './data.js';
import {
  createInitialState,
  filterReviews,
  recordReview,
  statusFor,
  STORAGE_KEY,
  summarizeReviews,
  validateEmail,
} from './state.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  publicView: $('#public-view'),
  appView: $('#app-view'),
  reviewList: $('#review-list'),
  resultCount: $('#result-count'),
  reviewSearch: $('#review-search'),
  sortSelect: $('#sort-select'),
  navCount: $('#nav-count'),
  statOpen: $('#stat-open'),
  statNeeds: $('#stat-needs'),
  statChanges: $('#stat-changes'),
  statApproved: $('#stat-approved'),
  activityList: $('#recent-activity'),
  appUser: $('#app-user'),
  dashboardGreeting: $('#dashboard-greeting'),
  authDialog: $('#auth-dialog'),
  authForm: $('#auth-form'),
  authEmail: $('#auth-email'),
  authError: $('#auth-error'),
  authSubmit: $('#auth-submit'),
  reviewDialog: $('#review-dialog'),
  reviewDialogBody: $('#review-dialog-body'),
  themeToggle: $('#theme-toggle'),
  logoutButton: $('#logout-button'),
  menuToggle: $('#public-menu-toggle'),
  publicNav: $('#public-nav'),
  toast: $('#toast'),
};

let state = loadState();
let currentFilter = 'all';
let currentSort = 'priority';
let currentQuery = '';
let lastTrigger = null;
let toastTimer = null;

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialState();
    const parsed = JSON.parse(stored);
    return {
      user: parsed.user && typeof parsed.user.email === 'string' ? parsed.user : null,
      decisions: parsed.decisions && typeof parsed.decisions === 'object' ? parsed.decisions : {},
      activity: Array.isArray(parsed.activity) ? parsed.activity.slice(0, 8) : [],
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return createInitialState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The demo still works when storage is unavailable.
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function applyTheme() {
  const theme = state.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  elements.themeToggle.textContent = theme === 'dark' ? 'Switch to light' : 'Switch theme';
  for (const button of $$('[data-theme-toggle]')) {
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function toggleTheme() {
  state = { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
  saveState();
  applyTheme();
}

function setError(input, errorElement, message) {
  if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
  errorElement.textContent = message;
}

function openDialog(dialog, trigger) {
  if (!dialog || dialog.open) return;
  lastTrigger = trigger || document.activeElement;
  dialog.showModal();
  document.body.classList.add('modal-open');
  const focusTarget = dialog.querySelector('input, textarea, select, button, [href]');
  if (focusTarget) window.setTimeout(() => focusTarget.focus(), 0);
}

function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.close();
}

function syncBodyModalState() {
  document.body.classList.toggle('modal-open', $$('dialog[open]').length > 0);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
}

function openAuth(trigger = null) {
  setError(elements.authEmail, elements.authError, '');
  openDialog(elements.authDialog, trigger);
}

function showPublic() {
  elements.appView.hidden = true;
  elements.publicView.hidden = false;
  document.body.classList.remove('app-mode');
  window.scrollTo(0, 0);
}

function showApp() {
  elements.publicView.hidden = true;
  elements.appView.hidden = false;
  document.body.classList.add('app-mode');
  window.scrollTo(0, 0);
}

function renderStats() {
  const summary = summarizeReviews(reviews, state.decisions);
  elements.statOpen.textContent = String(summary.open);
  elements.statNeeds.textContent = String(summary.needsReview);
  elements.statChanges.textContent = String(summary.changesRequested);
  elements.statApproved.textContent = String(summary.approved);
  elements.navCount.textContent = String(summary.needsReview);
}

function renderSession() {
  const isSignedIn = Boolean(state.user);
  elements.appUser.textContent = state.user?.email || 'Demo reviewer';
  elements.dashboardGreeting.textContent = state.user
    ? `Signed in as ${state.user.email}. Review decisions stay in this browser only.`
    : 'Pick a review and leave a clear decision.';
  for (const button of $$('[data-open-auth]')) {
    button.hidden = false;
    if (isSignedIn) {
      button.textContent = 'Open review queue';
    } else if (button.classList.contains('text-button')) {
      button.textContent = 'Log in';
    } else {
      button.textContent = button.classList.contains('button-light') ? 'Open the demo queue' : 'Open demo queue';
    }
    if (isSignedIn && button.classList.contains('text-button')) button.hidden = true;
  }
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${statusLabels[status] || status}</span>`;
}

function renderReviewCard(review) {
  const status = statusFor(review, state.decisions);
  const label = riskLabels[review.risk] || review.risk;
  return `
    <button class="review-card" type="button" data-review-id="${review.id}" aria-label="Open review ${escapeHtml(review.repo)} #${review.number}: ${escapeHtml(review.title)}">
      <span class="review-card-top">
        <span class="repo-name">${escapeHtml(review.repo)}</span>
        <span class="pr-number">#${review.number}</span>
        <span class="risk-badge risk-${review.risk}">${label}</span>
        <span class="status-badge status-${status}">${statusLabels[status] || status}</span>
      </span>
      <span class="review-title">${escapeHtml(review.title)}</span>
      <span class="review-card-summary">${escapeHtml(review.summary)}</span>
      <span class="review-card-meta">
        <span>${review.files} files</span>
        <span>+${review.additions}</span>
        <span>-${review.deletions}</span>
        <span>${review.age} ago</span>
      </span>
      <span class="review-card-bottom">
        <span class="author"><span class="avatar">${escapeHtml(review.initials)}</span>${escapeHtml(review.author)}</span>
        <span class="checks checks-${review.checks}">${review.checks}</span>
      </span>
    </button>`;
}

function renderQueue() {
  const filtered = filterReviews(reviews, {
    query: currentQuery,
    status: currentFilter,
    sort: currentSort,
    decisions: state.decisions,
  });
  elements.resultCount.textContent = `${filtered.length} review${filtered.length === 1 ? '' : 's'}`;
  if (!filtered.length) {
    elements.reviewList.innerHTML = `
      <div class="empty-state">
        <strong>No reviews match that view.</strong>
        <p>Try another status or clear the search.</p>
      </div>`;
    return;
  }
  elements.reviewList.innerHTML = filtered.map(renderReviewCard).join('');
}

function renderActivity() {
  const items = state.activity.length ? state.activity.map((item) => {
    const review = reviews.find((entry) => entry.id === item.reviewId);
    return {
      type: item.type,
      actor: state.user?.email?.split('@')[0] || 'you',
      target: review ? `${review.repo}#${review.number}` : 'a review',
      time: item.at,
    };
  }) : activitySeed;
  elements.activityList.innerHTML = items.map((item) => `
    <div class="activity-item">
      <span class="activity-icon ${escapeHtml(item.type)}"></span>
      <span class="activity-copy"><b>${escapeHtml(item.actor)}</b> ${escapeHtml(activityVerb(item.type))} ${escapeHtml(item.target)}<span class="activity-time">${escapeHtml(item.time)}</span></span>
    </div>`).join('');
}

function activityVerb(type) {
  if (type === 'approved') return 'approved';
  if (type === 'changes-requested') return 'requested changes on';
  if (type === 'comment') return 'left a note on';
  return 'reviewed';
}

function render() {
  renderStats();
  renderQueue();
  renderActivity();
  renderSession();
  applyTheme();
}

function openReview(reviewId) {
  const review = reviews.find((item) => item.id === reviewId);
  if (!review) return;
  const status = statusFor(review, state.decisions);
  const decision = state.decisions[review.id];
  const note = decision?.note || '';
  elements.reviewDialogBody.dataset.reviewId = review.id;
  elements.reviewDialogBody.innerHTML = `
    <div class="dialog-head">
      <button class="modal-close" type="button" data-close-dialog aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <p class="modal-kicker">Review request</p>
      <h2 id="review-dialog-title">${escapeHtml(review.title)}</h2>
      <p class="dialog-meta">${escapeHtml(review.repo)} #${review.number} · ${escapeHtml(review.author)} · ${escapeHtml(review.branch)}</p>
    </div>
    <div class="dialog-body">
      <div>
        <h3>What changed</h3>
        <p>${escapeHtml(review.summary)}</p>
        <h3>Questions before a decision</h3>
        <ul class="finding-list">${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join('')}</ul>
      </div>
      <aside class="dialog-side">
        <div class="side-fact"><span>Risk</span><strong>${riskLabels[review.risk]}</strong></div>
        <div class="side-fact"><span>Scope</span><strong>${review.files} files · +${review.additions} / -${review.deletions}</strong></div>
        <div class="side-fact"><span>Checks</span><strong>${review.checks} · ${review.coverage} coverage</strong></div>
        <div class="side-fact"><span>Current status</span><strong>${statusLabels[status] || status}</strong></div>
        <label class="dialog-note-label" for="review-note">Review note</label>
        <textarea class="dialog-note" id="review-note" placeholder="Name the risk and the next action.">${escapeHtml(note)}</textarea>
      </aside>
    </div>
    <div class="dialog-actions">
      <button class="button button-secondary" type="button" data-decision="comment">Comment only</button>
      <button class="button button-secondary" type="button" data-decision="changes-requested">Request changes</button>
      <button class="button button-primary" type="button" data-decision="approved">Approve</button>
    </div>`;
  openDialog(elements.reviewDialog);
}

function handleDecision(decision) {
  if (!state.user) {
    closeDialog(elements.reviewDialog);
    openAuth();
    return;
  }
  const reviewId = elements.reviewDialogBody.dataset.reviewId;
  if (!reviewId) return;
  const note = $('#review-note')?.value || '';
  state = recordReview(state, reviewId, decision, note);
  saveState();
  closeDialog(elements.reviewDialog);
  render();
  showToast(decision === 'comment' ? 'Review note saved.' : decision === 'approved' ? 'Review approved.' : 'Changes requested.');
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const email = elements.authEmail.value.trim();
  const error = validateEmail(email);
  setError(elements.authEmail, elements.authError, error);
  if (error) {
    elements.authEmail.focus();
    return;
  }
  elements.authSubmit.disabled = true;
  elements.authSubmit.textContent = 'Opening the queue...';
  window.setTimeout(() => {
    state = { ...state, user: { email } };
    saveState();
    elements.authSubmit.disabled = false;
    elements.authSubmit.textContent = 'Open demo queue';
    closeDialog(elements.authDialog);
    render();
    showApp();
    showToast('Demo reviewer session started.');
  }, 300);
}

function initialize() {
  for (const review of reviews) {
    if (!review.status) review.status = 'needs-review';
  }
  render();
  showPublic();

  for (const button of $$('[data-open-auth]')) {
    button.addEventListener('click', () => {
      if (state.user) showApp();
      else openAuth(button);
    });
  }
  for (const button of $$('[data-show-public]')) {
    button.addEventListener('click', showPublic);
  }
  elements.authForm.addEventListener('submit', handleAuthSubmit);
  elements.authEmail.addEventListener('input', () => {
    if (elements.authEmail.getAttribute('aria-invalid') === 'true') {
      setError(elements.authEmail, elements.authError, validateEmail(elements.authEmail.value));
    }
  });
  elements.reviewSearch.addEventListener('input', (event) => {
    currentQuery = event.target.value;
    renderQueue();
  });
  elements.sortSelect.addEventListener('change', (event) => {
    currentSort = event.target.value;
    renderQueue();
  });
  for (const tab of $$('[data-filter]')) {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter;
      for (const item of $$('[data-filter]')) {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      }
      renderQueue();
    });
  }
  elements.reviewList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-review-id]');
    if (card) openReview(card.dataset.reviewId);
  });
  elements.reviewDialogBody.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-dialog]')) closeDialog(elements.reviewDialog);
    const decision = event.target.closest('[data-decision]')?.dataset.decision;
    if (decision) handleDecision(decision);
  });
  elements.reviewDialog.addEventListener('click', (event) => {
    if (event.target === elements.reviewDialog) closeDialog(elements.reviewDialog);
  });
  elements.reviewDialog.addEventListener('close', () => {
    syncBodyModalState();
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    lastTrigger = null;
  });
  elements.authDialog.addEventListener('close', syncBodyModalState);
  elements.authDialog.addEventListener('click', (event) => {
    if (event.target === elements.authDialog) closeDialog(elements.authDialog);
  });
  for (const button of $$('[data-close-dialog]', elements.authDialog)) {
    button.addEventListener('click', () => closeDialog(elements.authDialog));
  }
  elements.themeToggle.addEventListener('click', toggleTheme);
  for (const button of $$('[data-theme-toggle]')) {
    button.addEventListener('click', toggleTheme);
  }
  elements.logoutButton.addEventListener('click', () => {
    state = { ...state, user: null };
    saveState();
    render();
    showPublic();
    showToast('Logged out of the demo reviewer.');
  });
  for (const button of $$('[data-logout]')) {
    button.addEventListener('click', () => {
      state = { ...state, user: null };
      saveState();
      render();
      showPublic();
      showToast('Logged out of the demo reviewer.');
    });
  }
  elements.menuToggle.addEventListener('click', () => {
    const open = elements.publicNav.classList.toggle('is-open');
    elements.menuToggle.setAttribute('aria-expanded', String(open));
    elements.menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  for (const link of $$('a', elements.publicNav)) {
    link.addEventListener('click', () => {
      elements.publicNav.classList.remove('is-open');
      elements.menuToggle.setAttribute('aria-expanded', 'false');
      elements.menuToggle.setAttribute('aria-label', 'Open menu');
    });
  }
  if (state.user) showApp();
}

initialize();
