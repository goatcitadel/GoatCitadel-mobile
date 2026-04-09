# Mobile Icon Review

This folder is a review-only icon exploration pack for the GoatCitadel mobile app.

It does not replace the live Expo icon assets yet.

## Current live asset wiring

The app currently points at these files in [app.json](/F:/code/personal-ai-mobile-app/app.json):

- `./assets/icon.png`
- `./assets/android-icon-foreground.png`
- `./assets/android-icon-background.png`
- `./assets/android-icon-monochrome.png`
- `./assets/favicon.png`

## Concepts

- `concept-a-bastion-g.png`
  - frontal citadel with an integrated `G`
  - strongest direct read
- `concept-b-keeper-g.png`
  - more emblematic / protected keep feel
  - best if you want a slightly more premium badge look
- `concept-c-night-gate.png`
  - broad fortress silhouette with the cleanest small-size read
  - most app-icon-native of the set

## Review locally

Open [index.html](/F:/code/personal-ai-mobile-app/assets/icon-review/index.html) in a browser.

If the PNGs need to be regenerated, run:

- [generate-citadel-icons.ps1](/F:/code/personal-ai-mobile-app/assets/icon-review/generate-citadel-icons.ps1)

## Adoption path

Once you choose a direction:

1. turn the chosen master into final `1024x1024` export assets
2. derive the Android adaptive foreground/background/monochrome files intentionally instead of reusing one flattened icon everywhere
3. rebuild the app so the device launcher icon actually updates
