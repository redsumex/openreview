# OpenReview

OpenReview is a working front-end concept for an open code-review desk. It gives a review queue a clear shape: every request carries its risk, scope, CI state, open questions, and a visible decision.

The public surface is a landing page for the review model. The review queue is a separate signed-in workspace with filtering, priority sorting, review detail, notes, and approve / request-changes / comment actions.

## Run it

```powershell
cd openreview
npm start
```

Open `http://localhost:4174`.

No dependencies are required. The site is plain HTML, CSS, and ES modules, served by a small Node static server.

## What works

- Responsive public landing page and separate review desk.
- Reviewer sign-in with browser-local persistence.
- Live queue backed by public GitHub pull requests, with sample data as a fallback.
- Risk, scope, labels, and age derived from the pull request.
- Search, status filters, and priority / size / age sorting.
- Review detail dialog with evidence, open questions, and a note field.
- Approve, request changes, and comment-only decisions.
- Queue counts, activity trail, and a rules panel.
- Light and dark theme.
- Native `<dialog>` modals with Escape-to-close and focus return.
- Empty states, form validation, and polite toast announcements.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | Public landing page, app shell, and dialogs |
| `styles.css` | Design tokens, layouts, components, and responsive rules |
| `src/data.js` | Sample review requests, labels, and activity |
| `src/github.js` | Read-only GitHub pull request adapter and queue mapping |
| `src/state.js` | Pure filters, status calculations, and review decisions |
| `src/app.js` | Rendering, dialogs, local auth, filters, and theme behavior |
| `server.mjs` | Zero-dependency static server on port `4174` |
| `test/state.test.js` | Unit tests for filtering, sorting, and decisions |
| `test/github.test.js` | Adapter mapping, request budget, empty, and rate-limit tests |
| `test/ui-contract.test.js` | Mark, queue, and dialog contract checks |
| `test/site.test.js` | Static server and asset smoke test |

## Validate

```powershell
npm run check
npm test
```

## Format workflow

`npm run format` dispatches the GitHub `Format` workflow and watches the run:

```powershell
npm run format
npm run format -- --ref feature/my-change
npm run format -- --no-wait
```

The workflow currently validates source syntax and tests. It does not rewrite files. Keep local formatting fast and deterministic, and use this dispatcher to verify the remote gate.

## Important limits

This is a front-end review desk, not a production review service.

- There is no GitHub OAuth, write API, database, background worker, or email delivery.
- The queue reads public pull requests from `redsumex/openreview` without a token.
- The GitHub REST API allows 60 unauthenticated requests per hour per IP. The adapter uses one list request plus up to eight detail requests per load.
- If GitHub is unavailable or rate-limited, the app keeps the sample queue visible and shows a retry action.
- Reviews, notes, and decisions persist only in this browser's `localStorage`.
- The sample repositories and review requests are fictional demo data.
- The action buttons update the local queue; they do not write to GitHub.

## Published repository

The app is live at [redsumex.github.io/openreview](https://redsumex.github.io/openreview/) from the `main` branch. The source is in [redsumex/openreview](https://github.com/redsumex/openreview).

CI runs `npm run check` and `npm test` on pushes to `main` and pull requests. GitHub Pages builds from the repository root.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

Changes to `main` must go through a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.
