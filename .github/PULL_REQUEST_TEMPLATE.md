## Change

<!-- Describe the problem, resulting behavior and any material risks or limitations. -->

## Full-suite validation

<!-- Record validation commands/results and link the CI run for this PR's latest revision. -->

- [ ] The required GitHub Actions `full-suite` check passes on the current revision, including typecheck, lint, build, Node tests, Chromium, Firefox, WebKit, visual regressions, accessibility checks, Node/browser benchmarks and formatting.
- [ ] Any failures were investigated using the run's `gallery-reports-<run id>-<attempt>` artifact (logs, JSON reports, screenshots and visual diffs), then fixed and rerun.

## Visual regression review

<!-- State "No visual changes" or describe the affected UI and attach comparison evidence. Mark conditional items N/A when they do not apply. -->

- [ ] Reviewed the visual impact; for UI or baseline changes, inspected actual, expected and diff screenshots for each affected browser and viewport.
- [ ] Any baseline updates are intentional, explained and reviewed; baselines were not regenerated or thresholds relaxed merely to make CI pass. An independent comparison run passes after any update.

## Protected-main workflow

- [ ] This PR targets `main` from a topic branch and is up to date with `main`. Further updates must pass their own CI checks.
- [ ] Merge only after the current required `full-suite` check passes; the same protection applies to administrators, without bypasses or direct pushes to `main`.

After merging, GitHub automatically deletes the remote topic branch. Confirm full CI passes on `main`, then clean up the local branch after confirming the merge.

See the [protected-main contribution workflow](https://github.com/curler7/remix3-image-gallery#contributing-through-protected-main).
