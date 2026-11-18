# Contributing

Changes to `main` must go through a pull request.

1. Create a branch from `main`.
2. Make the change and run `npm run check` and `npm test`.
3. Optionally run `npm run format -- --ref <your-branch>` to dispatch the GitHub Format workflow.
4. Push the branch and open a pull request against `main`.
5. Wait for the CI and Format workflows to pass.
6. Merge through the pull request after review.

Direct pushes, force pushes, and branch deletion are disabled on `main`.

The demo uses fictional review data. Do not add credentials, private keys, tokens, or machine-specific paths to commits, issues, pull requests, or documentation.
