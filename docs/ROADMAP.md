# Known limitations and roadmap

## Known limitations (current state)

**Data**
- Only fictional demo data is included. No Salahaddin University buildings, maps, lecturers or timetables have been entered — this requires authorised university staff and verified sources.
- Demo floor plans are generated rectangles, labelled as demonstrations everywhere they appear.

**Not verified against live services**
- Supabase-backed operation (auth sign-in, storage uploads, PostgREST queries from the apps) has not been run against a real project; the SQL layer is tested on PostgreSQL directly.
- The `invite-member` edge function is unexecuted.
- The mobile app has not been run on a device or simulator.

**Product gaps**
- Admin dashboard UI text is English-only; data entry is trilingual (en/ckb/ar). Student web and mobile apps are fully localised.
- Student accounts: the student apps work anonymously with device-local saved places, group and history. Signed-in sync of preferences/saved locations is supported by the schema (`user_preferences`, `saved_locations`) but no student sign-in UI exists yet.
- Remote push notifications for schedule changes: client token retrieval and table exist; the server-side sender is not implemented. Local reminders work.
- Excel files must be saved as CSV (UTF-8) before timetable import; native `.xlsx` parsing is not included.
- Polygons can be stored and rendered, but the map editor draws rectangles only (edit coordinates for other shapes).
- Lecturer `availability` is displayed only when set by an authorised source; there is no lecturer self-service UI yet (the database permits it).
- Web reminders fire only while the app/tab is open (no Web Push server).
- Campus overview: admins can upload a campus picture (aerial screenshot or official plan) and draw building footprints on it; it is not a geo-referenced map (no live map tiles or GPS coordinates).
- Translations need native-speaker review.

**Security/operations** — see [SECURITY.md › residual risks](SECURITY.md#residual-risks-and-required-actions-before-production).

## Roadmap

### Next (before SUL pilot)
1. Staging Supabase project; run apps and edge function against it; add integration tests with a real project in CI.
2. Run the mobile app on Android/iOS devices; add Maestro or Detox smoke flows.
3. Accessibility audit (axe + TalkBack/VoiceOver); Safari/Firefox e2e projects.
4. Admin UI localisation (Sorani/Arabic) and lecturer self-service screen.
5. Student sign-in (magic link) with sync of group, saved places and reminders.
6. Schedule-change push sender (DB webhook → edge function → Expo Push).
7. Cookie-based admin sessions (`@supabase/ssr`) and nonce CSP.
8. Pilot data entry with SUL staff for one building; field-test QR signs and timing assumptions.

### Later — campus services
Library directory, cafeteria menus, student services, lost & found, events, study-room / lab / facility booking (exclusion constraints on time ranges, reusing conflict logic).

### Later — smart campus
Room availability from the booking/timetable data; occupancy and IoT feeds only where a reliable source exists; building information pages; digital twin export from the navigation graph.

### Later — advanced navigation
BLE/Wi-Fi indoor positioning as an alternative start-node provider; voice guidance from localized step sentences; 2.5D/3D rendering using floor levels and vertical groups; AR overlays; geo-referenced outdoor routing between buildings; per-campus bundle splitting for large universities.

### AI campus assistant
Plug an LLM-backed `IntentParser` (any provider, optional) behind the existing intent/answer boundary; keep answers sourced only from the campus bundle; add evaluation sets in all three languages.
