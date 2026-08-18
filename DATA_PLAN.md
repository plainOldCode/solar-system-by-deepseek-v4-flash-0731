# Astronomical Data Plan

Version: final (t_59e60083). The dataset was populated by the "core
astronomical data" phase using the sources listed here, and is validated by
`src/data/validate.ts` + its 29-test suite. It is now the historical contract;
the README's *Data model, units, and sources* section is the working reference.

## 1. Required bodies

Total: **35** bodies = 1 star + 8 planets + 1 dwarf planet + 25 moons.

- **Star**: Sun
- **Planets (8)**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **Dwarf planet (1)**: Pluto — selectable/focusable/inspectable like a planet
- **Moons (25)** grouped under a parent planet:

| Parent   | Moons                                               |
|----------|-----------------------------------------------------|
| Earth    | Moon                                                |
| Mars     | Phobos, Deimos                                      |
| Jupiter  | Io, Europa, Ganymede, Callisto                      |
| Saturn   | Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus |
| Uranus   | Miranda, Ariel, Umbriel, Titania, Oberon            |
| Neptune  | Triton                                              |
| Pluto    | Charon, Styx, Nix, Kerberos, Hydra                  |

Criteria for the set (documented in README): a fixed pool of "major" moons —
Earth's single moon, each planet's largest Galilean-style moons, Saturn's major
icy moons + Titan, Uranus's 5 major moons, Neptune's Triton, Pluto's 5 known
moons including Charon. Ordered by real orbital distance; stored in data file so
more can be added without changing the rendering engine.

## 2. Fields and units (data model per spec §7)

| Field                | Type/values                      | Unit            | Notes                        |
|----------------------|----------------------------------|-----------------|------------------------------|
| id                   | string                          | —               | slug, e.g. `jupiter`        |
| nameKo / nameEn      | string                          | —               | Korean + English            |
| type                 | star/planet/dwarf-planet/moon   | —               | union literal                |
| parentId             | string?                         | —               | moons only; else undefined  |
| radiusKm             | number                          | km              | actual radius               |
| semiMajorAxis        | number?                         | AU (planets) / km (moons) | heliocentric AU for planets/dwarf; distance from parent in km for moons |
| eccentricity         | number? [0,1]                   | —               | orbital eccentricity        |
| inclinationDeg       | number?                         | degrees         | orbital inclination         |
| orbitalPeriodDays    | number?                         | days            | sidereal period             |
| rotationPeriodHours  | number?                         | hours           | sidereal rotation (signed: negative = retrograde) |
| axialTiltDeg         | number?                         | degrees         | display tilt                |
| displayColor         | string (hex)                    | —               | procedural material color   |
| description          | string?                         | —               | short Korean description    |

All `?` fields are optional (e.g. Sun has no semiMajorAxis). Plants have
`rotationPeriodHours`; some values must be signed for retrograde rotation
(Venus). Units are declared per field in the type and repeated in the README.

## 3. Provenance (data sources)

Real values, not invented — sourced from public NASA/JPL pages (to be cited in
the README's data-sources section and recorded per-body where feasible):

- **NASA Planetary Fact Sheets** (NSSDC): radius, sideral rotation period,
  orbital period, semi-major axis, orbital inclination, axial tilt for Sun +
  8 planets.
- **NASA Dwarf Planet / Pluto fact sheet**: Pluto's eccentricity (0.248),
  inclination (17.16°) must be visibly greater than the planets.
- **NASA Moons fact sheets**: moon radius, semi-major axis (km from parent),
  orbital period for all 25 moons.

Precision: 3–5 significant figures is ample ("need not be unnecessary
precision" per spec §15). Accuracy requirement is relative-order correctness:
planet distance order, planet size order, orbital-period order, correct moon
parentage and moon-distance order, and Pluto's notably higher e/i.

## 4. Hierarchy

```
Sun (root)
├── Mercury        ├── Jupiter
├── Venus          │   ├── Io
├── Earth          │   ├── Europa
│   └── Moon       │   ├── Ganymede
├── Mars           │   └── Callisto
│   ├── Phobos     ├── Saturn
│   └── Deimos     │   ├── Mimas ... Iapetus (7)
│                  ├── Uranus (5 moons)
│                  ├── Neptune — Triton
│                  └── Pluto — Charon, Styx, Nix, Kerberos, Hydra
```

Sail `.parentId` for moons; planets/dwarf/star have no parent → implicitly
orbiting the Sun. Tree depth ≤ 2 (Sun → planet → moon).

## 5. Validation strategy

Bootstrap-phase guarantees; full checks land in the tests/validation phase:

1. `npm install` resolves and `npm run build` (tsc --noEmit + vite build)
   succeeds with zero TS errors — run as a bootstrap check this phase.
2. **Dataset validator** (to be added in tests phase) assertion list:
   - every body has a truthy `id`, `nameKo`, `nameEn`, valid `type`;
   - `type === "moon"` ⇒ `parentId` set and parent exists in dataset;
   - `type !== "moon"` ⇒ `semiMajorAxisUnit === "AU"` and distances strictly
     increase over planets+dwarf ordered by distance (Mercury < Venus < … <
     Pluto);
   - `type === "moon"` ⇒ semi-major-axis in km, unit "km", and each moon's
     parent is a planet/dwarf; moon distances within a system keep real order;
   - eccentricity ∈ [0,1]; inclination ∈ [0,180]; radii/periods > 0;
   - Pluto eccentricity > 0.2 and inclination > 12° (sanity);
   - planet size order matches radius ordering.
3. Duplicate-id check to keep the map lookup unique.

These are staged behind later phases; the current commit only fixes the layout
and runs the tooling-level checks.
