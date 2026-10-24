# Main branch protection verification

The `main` branch requires a pull request and a successful GitHub Actions `full-suite` check. The check is bound to the GitHub Actions application, branches must be up to date, and administrators are subject to the same protection. Force pushes and branch deletion are disabled.

Verification uses a temporary failing Node test on a pull request branch, followed by an administrator merge attempt while the required check is failing. The temporary test is then removed and the complete suite runs again before checking merge eligibility. No protection settings are relaxed during the test.

## Recorded checks

Test pull request: [#1](https://github.com/curler7/remix3-image-gallery/pull/1). The authenticated account was `curler7`, with repository permission `ADMIN`.

| Required check state | Administrator merge attempt | GitHub response                                      |
| -------------------- | --------------------------- | ---------------------------------------------------- |
| In progress          | Rejected, HTTP 405          | `Required status check "full-suite" is in progress.` |
| Failing              | Rejected, HTTP 405          | `Required status check "full-suite" is failing.`     |

The [intentional failure run](https://github.com/curler7/remix3-image-gallery/actions/runs/40062113526) reported 21 Node tests: the existing 20 passed and the temporary protection test failed. The PR remained open and its merge state was `BLOCKED`; GitHub reported `viewerCanMergeAsAdmin: false`.

The temporary test was removed in the following commit. The final PR diff retains only this verification document. Check the PR's current required checks and merge state for the passing phase; a ready merge must show successful `full-suite` checks and `CLEAN` merge state. Protection settings remain enabled for administrators throughout.
