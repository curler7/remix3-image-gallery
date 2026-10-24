# Main branch protection verification

The `main` branch requires a pull request and a successful GitHub Actions `full-suite` check. The check is bound to the GitHub Actions application, branches must be up to date, and administrators are subject to the same protection. Force pushes and branch deletion are disabled.

Verification uses a temporary failing Node test on a pull request branch, followed by an administrator merge attempt while the required check is failing. The temporary test is then removed and the complete suite runs again before checking merge eligibility. No protection settings are relaxed during the test.
