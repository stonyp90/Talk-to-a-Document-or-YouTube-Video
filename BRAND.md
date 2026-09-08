# Ursly brand

Ursly is the public product name. “Talk to a Source” describes what it does.
The existing package identifiers, URL scheme and Expo slug remain stable so
branding changes do not create a different application or break existing links.

The mark is five rounded voice bars in an ink waveform on a coral tile. Use it
with the lowercase `ursly.` wordmark in headers, or alone at small sizes. Keep
clear space around it; do not stretch it or substitute a generic microphone.

| Role | Color |
| --- | --- |
| Ink, text and waveform | `#292735` |
| Coral, mark and highlights | `#F27561` |
| Paper, main background | `#F8F5EF` |
| Lavender, secondary surfaces | `#E8E1F5` |
| Muted text | `#6B6773` |
| Accessible web accent text | `#A84332` |

Use dark text on coral. Coral is a highlight, not small text on a pale background.
Keep functional labels readable and animation respectful of reduced motion.

## Assets and regeneration

Run `node scripts/brand/generate.mjs` from the repository root after `npm ci`.
The script is the vector master and produces every raster variant without a
remote image service. It also creates the 1200 × 630 social preview.

- Web header: `apps/web/public/brand/ursly-mark.svg`.
- Browser: `apps/web/app/icon.svg`, multi-resolution `favicon.ico` (16/32/48).
- Apple web shortcut: `apps/web/app/apple-icon.png` (180).
- Web manifest: 192/512 icons with separate regular and maskable entries.
- Native header: `apps/mobile/assets/brand-mark.png`.
- iOS and legacy Android: opaque 1024-pixel `icon.png`, no pre-rounded corners.
- Android adaptive and themed icons: transparent foregrounds with the mark
  inside the central safe zone; the operating system provides the mask.
- Native launch screen: `splash-icon.png`, cream background, ink in dark mode.
- Sharing: `apps/web/public/brand/social-card.png`, configured in page metadata.

The manifest provides shortcut branding; it does not add offline functionality.

## Shipping changes

Web assets ship with the Next.js deployment. Social services may cache old
previews until their cache is refreshed. App launcher names, icons and splash
screens require a new native build and installation; a JavaScript update alone
does not replace them. Run Expo prebuild, then build Android/iOS through the
existing signed release process. Never change package IDs to force a new icon.
