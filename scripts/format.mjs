import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: npm run format -- [options]

Dispatch the GitHub Format workflow and wait for it to finish.

Options:
  --repo <owner/repo>   Repository to use (defaults to GITHUB_REPOSITORY or the current gh repository)
  --ref <branch>        Branch to run the workflow against (defaults to the repository default branch)
  --no-wait             Dispatch the workflow without watching the run
  -h, --help            Show this help

Examples:
  npm run format
  npm run format -- --ref feature/my-change
  npm run format -- --no-wait
`);
  process.exit(0);
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : '';
}

function runGh(ghArgs, options = {}) {
  const output = execFileSync('gh', ghArgs, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  return output ? output.trim() : '';
}

function latestRun(repo) {
  const output = runGh([
    'run',
    'list',
    '--workflow',
    'format.yml',
    '--repo',
    repo,
    '--limit',
    '1',
    '--json',
    'databaseId,url,status,headBranch',
  ]);
  const runs = JSON.parse(output || '[]');
  return runs[0] || null;
}

const explicitRepo = valueAfter('--repo');
const ref = valueAfter('--ref');
const wait = !args.includes('--no-wait');

let repo = explicitRepo || process.env.GITHUB_REPOSITORY || '';
if (!repo) {
  try {
    repo = runGh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  } catch {
    console.error('Could not determine the repository. Pass --repo owner/repo.');
    process.exit(1);
  }
}

if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
  console.error(`Invalid repository "${repo}". Use owner/repo.`);
  process.exit(1);
}

const before = latestRun(repo);
const dispatchArgs = ['workflow', 'run', 'format.yml', '--repo', repo];
if (ref) dispatchArgs.push('--ref', ref);

try {
  runGh(dispatchArgs);
} catch (error) {
  console.error('Could not dispatch the Format workflow. Is gh installed and authenticated?');
  if (error.stderr) process.stderr.write(error.stderr);
  process.exit(1);
}

console.log(`Dispatched Format for ${repo}${ref ? ` on ${ref}` : ''}.`);

if (!wait) process.exit(0);

let run = null;
for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  run = latestRun(repo);
  if (run && run.databaseId !== before?.databaseId) break;
}

if (!run || run.databaseId === before?.databaseId) {
  console.error('The dispatched run did not appear in the workflow run list.');
  process.exit(1);
}

console.log(`Watching run ${run.databaseId}: ${run.url}`);
try {
  runGh(['run', 'watch', String(run.databaseId), '--repo', repo, '--exit-status'], { inherit: true });
} catch {
  console.error('The Format workflow did not finish successfully.');
  process.exit(1);
}
