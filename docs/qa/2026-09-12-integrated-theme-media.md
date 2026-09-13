# Integrated local app and theme-aware media

Date: 2026-09-12

## Included work

All four requested worktrees are already combined in commit `9b459fa`:

| Worktree | Included branch |
| --- | --- |
| `talk-to-a-document-hero` | `feat/hero-leads-with-the-loop` |
| `talk-to-a-document-pricing` | `feat/pricing-free-or-paid` |
| `talk-to-a-document-intro-v2` | `intro/web-three-story` |
| `talk-to-a-document-mobile-qa` | `fix/auth-mode-switch` |

Git ancestry checks confirmed every branch above is contained in HEAD. The
local integration uses `talk-to-a-document-mobile-qa` on
`codex/theme-aware-media`. The unfinished main checkout was preserved.

The production build runs locally at <http://localhost:3200>, with its chat
service at <http://localhost:3220/health>. The Compose project is `ursly-qa`.
It uses deterministic provider/transcript fixtures, real local PDF extraction,
and MinIO for actual temporary uploads. No production deployment was performed.

## Changes

- The system color scheme selects the page's semantic colors. The animated
  loop and voice illustration use those same colors.
- Light mode retains the original film. Dark mode uses 72% brightness and 90%
  saturation. A theme change does not replace the video, restart playback, or
  enable autoplay. HTML controls retain their own colors.
- The video remains inside its stage and preserves the complete frame with
  `object-fit: contain`.
- Short phone and landscape layouts use four visible rows. The transcript
  scrolls below the film instead of overlapping it. Scene headlines use the
  same left content margin as the footer and video.
- An obsolete anonymous-session assertion now permits the language cookie
  while still rejecting every other cookie. Choosing English or French does
  not establish an authenticated session.
- HTTP loopback builds omit the CSP's HTTPS upgrade directive so Safari can
  load local scripts, styles and video. Deployed origins, HTTPS loopback,
  malformed and absent site URLs retain the upgrade. Nine security-header
  tests cover this boundary; the other security directives remain enforced.

## Verification

- Unit and contract tests: 764 passed across 85 files (`unit-release.log`).
- Lint: passed, with two existing mobile hook dependency warnings.
- TypeScript: passed.
- Secret scan: passed, no leaks detected in 153 commits.
- Theme tests: ten English/French cases, each switching between dark and light
  without reloading, at 320×568, 390×900, 768×1024, 844×390 and 1440×900.
  Checks include paused playback position, source identity, reduced motion,
  animation colors, title margins, full-frame fit and horizontal overflow.
- Final production browser suite: 132 passed (`browser-release-final.log`).
- Local BDD: 139 scenarios and 1,084 steps passed (`verified-bdd.log`).
- Additional Firefox/WebKit media matrix: 20 passed
  (`theme-browsers-final.log`). Each checks both languages at five viewports.
  The local Firefox automation reset its emulated color preference during
  navigation, so these transition tests apply light then dark after navigation.
  A separate first-paint probe using Firefox's native dark preferences also
  passed (dark media query, dark color scheme, correct film filter).

Visual evidence: `tmp/qa/2026-09-12-theme-media/index.html` contains 40 captures.
Raw execution logs: `/tmp/ursly-integrated-local-20260912/`.

## Local recovery and limits

The host ran out of disk space during verification. Docker's metadata writes
failed, MinIO refused writes, and some screenshot/trace files could not be
saved. These failures were retained in the raw logs and were not counted as
product passes. Reusable npm/build caches were cleared, identical dependency
files were verified and made to share APFS blocks, Docker was restarted, and
the previously running containers were restored. A real S3 write/delete probe
then passed before restarting the affected suites.

The host filled again during supplemental testing. Docker returned HTTP 500
for static files even while health endpoints answered. A second recovery
removed only this task's regenerable failed-test artifacts and unused Docker
build cache, restarted Docker, and restored all previously running containers.
The rebuilt app and its final browser suites passed after recovery. An
independent Safari failure was traced to HTTPS upgrading of HTTP loopback
assets and fixed as described above. Historical failures remain in text logs.

The local acceptance command excludes `@external`, as documented in the
project README. Real provider, deployment, and native-device scenarios require
their own environments; local mocks do not certify those integrations.
