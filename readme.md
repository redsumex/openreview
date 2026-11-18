# OpenReview

OpenReview is a working front-end concept for an open code-review desk. It gives a review queue a clear shape: every request carries its risk, scope, CI state, open questions, and a visible decision.

The public surface is a landing page for the review model. The demo queue is a separate signed-in workspace with filtering, priority sorting, review detail, notes, and approve / request-changes / comment actions.

## Run it

```powershell
cd openreview
npm start
```

Open `http://localhost:4174`.

No dependencies are required. The site is plain HTML, CSS, and ES modules, served by a small Node static server.

## What works

- Responsive public landing page and separate review desk.
- Demo reviewer sign-in with browser-local persistence.
- Review queue with risk, scope, CI state, labels, and age.
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
| `src/state.js` | Pure filters, status calculations, and review decisions |
| `src/app.js` | Rendering, dialogs, auth demo, filters, and theme behavior |
| `server.mjs` | Zero-dependency static server on port `4174` |
| `test/state.test.js` | Unit tests for filtering, sorting, and decisions |
| `test/ui-contract.test.js` | Mark, queue, and dialog contract checks |
| `test/site.test.js` | Static server and asset smoke test |

## Validate

```powershell
npm run check
npm test
```

## Important limits

This is a front-end demo, not a production review service.

- There is no GitHub OAuth, API connection, database, background worker, or email delivery.
- Reviews, notes, and decisions persist only in this browser's `localStorage`.
- The sample repositories and review requests are fictional demo data.
- The action buttons update the local queue; they do not write to GitHub.

## Publishing

The intended GitHub Pages URL is `https://redsumex.github.io/openreview/`. CI runs `npm run check` and `npm test` on pushes to `main` and pull requests.

## License

MIT. See [LICENSE](LICENSE).
