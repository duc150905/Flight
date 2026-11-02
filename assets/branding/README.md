# Flight identity — approved option C

Selected by the user on 2026-11-02: white upward-right airplane on turquoise.

- `source-c.png`: full-bleed production edit of the selected concept, generated
  with the built-in image_gen tool. Outside presentation margins were removed;
  the chosen airplane silhouette was retained.
- `app-icon.png`: opaque 1024×1024 PNG for Expo app icon and splash.
- `logo.png`: 128×128 PNG used by `FlightBrand` on discovery/account screens.
- `favicon.png`: 64×64 PNG for web.

The three sized assets are mechanical resamples of `source-c.png` using the
installed Expo image-utils. The production icon is square; the OS supplies its
launcher mask. Android uses this same opaque artwork with a turquoise background.
No separate themed monochrome mask is supplied. Failed transparent extraction
previews were discarded instead of shipping noisy artwork.

`app.json` overrides the starter iOS Icon Composer/Android adaptive assets, so
the Expo starter icon cannot take precedence. The original starter assets remain
unreferenced. No native ios/android folders were created or edited.

App icons and splash are build-time native settings: validate them with an EAS
preview/production build. Expo Go can show the in-app FlightBrand, but does not
prove the installed app icon or production splash appearance.

## Production prompt

EDIT TARGET: the approved Flight logo option C in the supplied image. Prepare the production square app icon, preserving the EXACT existing white airplane geometry, detached upper wing detail, upward-right orientation and centered position. Change only the background treatment: remove all outer white framing and the rounded turquoise tile boundary; extend a single uniform solid turquoise #00B8D0 background to ALL FOUR canvas edges and corners. The operating system will supply rounding. Keep the airplane at about 50% of square width, centered, with generous margin. Flat two-color vector-like rendering, crisp clean edges. The airplane must remain the same approved design; do not invent a different aircraft or add text, shadows, gradients, borders, extra icons or texture. Square high-resolution PNG, fully opaque.
