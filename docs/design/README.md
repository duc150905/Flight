# Flyora design references

Source of truth: [Flight Booking App in Figma](https://www.figma.com/design/5EA9XGrKonVC61F4t7StNh/Flight-Booking-App?node-id=0-1).

- `reference-8_flight/`: the 17 original screen PNGs extracted from the team's `8_flight.rar`.
- `figma-ready/`: 11 editable SVG snapshots of the additional screens. Open `figma-ready/index.html` locally for a contact sheet.
- `FLYORA-FIGMA-SCREENS.md`: screen inventory, sizing, colors, and implementation notes.

These files are **design references**, not runtime assets. TV1 discovery screens are implemented in `src/features/discovery/`; checkout screens belong to TV2. Keep prices, seat availability, and booking state driven by the app's server data rather than the sample values shown in the mockups.

The destination photos shown in the original screenshots were not supplied as separate image files. The app displays a destination image when `image_path` is a usable HTTPS URL and otherwise shows its airport code.
