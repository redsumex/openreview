const API_ROOT = 'https://api.github.com';

export class GitHubQueueError extends Error {
  constructor(message, { status = 0, rateLimitReset = null } = {}) {
    super(message);
    this.name = 'GitHubQueueError';
    this.status = status;
    this.rateLimitReset = rateLimitReset;
  }
}

export function initialsFor(login = '') {
  const parts = String(login)
    .replace(/\[bot\]$/i, '')
    .split(/[-_.\s]+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return String(parts[0] || '?').slice(0, 2).toUpperCase();
}

export function formatAge(minutes) {
  const value = Math.max(0, Math.floor(Number(minutes) || 0));
  if (value < 60) return `${Math.max(1, value)}m`;
  if (value < 1_440) return `${Math.floor(value / 60)}h`;
  return `${Math.floor(value / 1_440)}d`;
}

export function summarizeBody(body) {
  const text = String(body || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 'No description provided. Review the diff on GitHub.';
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}...` : text;
}

export function riskFor({ draft = false, additions = 0, deletions = 0, labels = [] } = {}) {
  const changes = Number(additions || 0) + Number(deletions || 0);
  const sensitive = labels.some((label) => /security|breaking|critical|billing/i.test(label));
  if (sensitive || changes > 400) return 'high';
  if (draft || changes > 100) return 'medium';
  return 'low';
}

export function mapPullRequest(pr, details = null, { now = Date.now(), repoFullName = '' } = {}) {
  const repo = repoFullName || pr?.base?.repo?.full_name || 'redsumex/openreview';
  const labels = Array.isArray(pr?.labels)
    ? pr.labels.map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean)
    : [];
  const additions = Number.isFinite(details?.additions) ? details.additions : null;
  const deletions = Number.isFinite(details?.deletions) ? details.deletions : null;
  const files = Number.isFinite(details?.changed_files) ? details.changed_files : null;
  const risk = riskFor({
    draft: Boolean(pr?.draft),
    additions: additions || 0,
    deletions: deletions || 0,
    labels,
  });
  const created = new Date(pr?.created_at || now).getTime();
  const ageMinutes = Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 60_000)) : 0;

  return {
    id: `gh-${repo.replace(/[^a-z0-9]+/gi, '-')}-${pr.number}`,
    repo,
    number: Number(pr.number),
    title: String(pr.title || `Pull request #${pr.number}`),
    author: pr?.user?.login || 'unknown',
    initials: initialsFor(pr?.user?.login),
    branch: pr?.head?.ref || 'unknown',
    risk,
    priority: risk === 'high' ? 3 : risk === 'medium' ? 2 : 1,
    files,
    additions,
    deletions,
    age: formatAge(ageMinutes),
    ageMinutes,
    checks: 'unknown',
    coverage: '-',
    labels,
    summary: summarizeBody(pr.body),
    findings: [],
    url: pr.html_url || `https://github.com/${repo}/pull/${pr.number}`,
    draft: Boolean(pr.draft),
    source: 'github',
    status: 'needs-review',
  };
}

async function readError(response) {
  const reset = response.headers.get('x-ratelimit-reset');
  const resetAt = reset ? new Date(Number(reset) * 1_000) : null;
  if (response.status === 403 || response.status === 429) {
    const resetText = resetAt && !Number.isNaN(resetAt.getTime())
      ? ` Try again after ${resetAt.toISOString()}.`
      : '';
    return new GitHubQueueError(`GitHub rate limit reached.${resetText}`, {
      status: response.status,
      rateLimitReset: resetAt,
    });
  }
  if (response.status === 404) {
    return new GitHubQueueError('The GitHub repository is unavailable.', { status: 404 });
  }
  return new GitHubQueueError(`GitHub returned HTTP ${response.status}.`, { status: response.status });
}

export async function fetchOpenReviews({
  owner = 'redsumex',
  repo = 'openreview',
  fetchImpl = globalThis.fetch,
  limit = 10,
  detailLimit = 8,
  now = Date.now(),
  signal,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new GitHubQueueError('This browser cannot load GitHub data.');
  }

  const repoFullName = `${owner}/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const listUrl = `${API_ROOT}/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${Math.max(1, Math.min(limit, 20))}`;
  const listResponse = await fetchImpl(listUrl, { headers, signal });
  if (!listResponse.ok) throw await readError(listResponse);

  const pullRequests = await listResponse.json();
  if (!Array.isArray(pullRequests)) {
    throw new GitHubQueueError('GitHub returned an unexpected pull request payload.');
  }

  const selected = pullRequests.slice(0, limit);
  const withDetails = await Promise.all(selected.map(async (pr, index) => {
    if (index >= detailLimit) return { pr, details: null };
    try {
      const detailResponse = await fetchImpl(
        `${API_ROOT}/repos/${owner}/${repo}/pulls/${pr.number}`,
        { headers, signal },
      );
      return {
        pr,
        details: detailResponse.ok ? await detailResponse.json() : null,
      };
    } catch {
      return { pr, details: null };
    }
  }));

  return withDetails.map(({ pr, details }) => mapPullRequest(pr, details, {
    now,
    repoFullName,
  }));
}
