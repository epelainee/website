A halftone galaxy. The site opens on a stippled eight-point star; click it and it
bursts into a wide arc of stars filling the top of the frame curving away to a 
clear horizon above the name. Each dot in that field is one experience: 
hover (or tap) to name it, click to open its detail.

Categories are navigated through the central star. Bring the pointer near it and
a ring of seven category buttons fades in; click one and the galaxy filters to
that category while the ring swaps to its subcategories, which you can drill
into further. Below root the ring also carries a `Show all` back to everything.
Move out to explore the galaxy and the ring fades away again. See
`## Navigation` below.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Editing content (Pages CMS)

Categories, subcategories, experiences, and site chrome live as JSON under
`content/` and are edited with [Pages CMS](https://pagescms.org) (git-based).
The site imports that JSON at **build time** — save in Pages CMS → commit to
GitHub → redeploy to see changes on the live site.

```bash
# 1. Push this repo to GitHub
# 2. Open https://pagescms.org and connect the repo
# 3. Edit via the UI (schema is `.pages.yml`)
# 4. Redeploy / rebuild after commits land
npm run dev      # uses content/ from disk
npm run build
```

| Path | What |
| --- | --- |
| `content/categories/*.json` | Top-level categories |
| `content/subcategories/*.json` | Subs (reference a category id) |
| `content/experiences/*.json` | Experience nodes |
| `content/site-settings.json` | Name, tagline, socials, favicon, embed meta, placeholders |
| `public/media/` | CMS uploads (favicon, og image) |
| `.pages.yml` | Pages CMS field schema |

Types/helpers stay in `src/data/`; the arrays themselves are no longer in TypeScript.

Everything visual is generated in code. There are no image assets.
(`public/hand-source.jpeg` is left over from an earlier concept and is unused —
delete it whenever.)

## The star

The star is not a separate object drawn over the galaxy: it **is** the galaxy,
with every point pulled back down its spike. That is why the burst is a single
number (`crush.progress`) and why the two states cannot drift apart.

Its shape lives in `scene/galaxyLayout.ts`:

- `SPIKE_LENGTHS` — the eight spikes. Vertical longest, horizontal a little
  shorter, diagonals short.
- `starPoint` — samples one point. Each spike is a real tapered needle: a
  position along its axis plus a perpendicular offset.
- `buildStarShell` — extra points that exist only to make the star opaque, and
  burn off as it bursts.

## Navigation

Three tiers, all driven off one array in the store (`path`):

```
[]              root      → all 64 nodes, ring shows the 7 categories
[catId]         category  → that category's nodes, ring shows its subcategories
[catId, subId]  subcat    → narrowed to that subcategory
```

- `NavRing` (`src/ui/NavRing.tsx`) — the ring of category / subcategory buttons.
  Renders one level, plus `Show all` below root. DOM, not 3D, so labels stay
  crisp.
- `Core` (`src/scene/Core.tsx`) — the central star. It also owns the ring's
  visibility (below).
- `HubHotspot` (`src/ui/HubHotspot.tsx`) — touch only; taps pin the ring open.

### When the ring shows

Opacity follows how close the pointer is to the star: solid within `NEAR`, gone
past `FAR` (both in `Core`). This is driven from the frame loop and written
straight to the DOM — the pointer moves every few ms, and re-rendering React for
each would thrash the tree, so `pointer.ts` keeps the position in a plain module
object.

Two things this deliberately avoids, both of which made an earlier version
clunky:

- **Selections do not hide the ring.** Hiding after each choice forced a
  round-trip back to the star for every step; drilling category → subcategory is
  now one continuous motion.
- **No hover target or timers.** The star is a small thing to hit, and a
  hide-delay flickers as the pointer crosses the gap to a button. Distance has
  neither problem.

Touch has no hover, so `pinned` in the store covers it: tap the star to keep the
ring up, tap again to dismiss. A `GRACE` window keeps the ring up for a few
seconds after the burst so it is seen at least once.

`store.ts` owns the moves: `enterCategory`, `enterSub` (re-selecting the active
sub steps back out — the same button drills in and backs out, which is how you
go up one level with the pointer), `showAll`, and `back`. `Galaxy`'s
`matches(cat, sub)` predicate drives both the fade and picking, so a faded-out
node can never answer the pointer.

### Going back

Esc or Backspace (`ui/useBackKey.ts` → `back()` in the store) undoes the last
spatial step, layered: an open detail panel closes first, then the path pops
one level, and at root the galaxy re-collapses into the intro star — click to
burst it again. The reversal costs nothing extra: `Galaxy`'s frame loop eases
`crush.progress` toward 0 whenever `phase` is `intro`, and the camera, core
and field all interpolate off that one number, so the burst plays backwards.
A press during the reform is a deliberate no-op, and a click mid-reform simply
re-bursts from wherever the animation has got to.

## Filling in experience copy

Many experience `dates` / `location` / `blurb` fields are still empty — edit them
in Pages CMS (or the JSON under `content/experiences/`). The detail panel shows
placeholders until filled. Category assignments are a first pass; reassign via
the subcategory field anytime.

## How it fits together

Two layers, deliberately separate:

- **WebGL** (`src/scene/`) — the whole scene renders through one halftone
  postprocess pass, so every object inherits the dot treatment for free.
- **DOM** (`src/ui/`) — nav ring, hover labels, detail panel, the name. Never
  postprocessed, so text stays crisp, selectable and readable by a screen
  reader.

| File | What it owns |
| --- | --- |
| `scene/galaxyLayout.ts` | Pure layout maths — the star's shape, and the field it bursts into. Seeded from each id, so the layout is stable across reloads without being regular. |
| `scene/Galaxy.tsx` | Instanced nodes + dust + the star shell, the burst, hover/click picking, path-based filtering. |
| `scene/HalftonePass.tsx` | The dot screen. One sample per grid cell, dot area tracking luminance. |
| `scene/Core.tsx` | The central star; the "up one level" control. |
| `scene/CameraRig.tsx` | Dollies from star framing out to the settled distance. |
| `ui/NavRing.tsx` | The ring of category / subcategory buttons. |
| `state/store.ts` | Phase, hover, selection, and the `path` navigation cursor. |

### Things that will bite you

- **The halftone cell is the floor on every dot.** The pass takes one sample per
  cell centre, so anything smaller than a cell mostly falls between samples and
  breaks into speckle — no matter how many of them there are. Most of the visual
  tuning here is really about staying above that floor.
- **`sizeAttenuation` is not world-space.** Three sizes points as
  `size * (height/2) / distance`, ignoring fov entirely, so a `pointsMaterial`
  size is NOT comparable to a mesh radius — at this fov points render several
  times smaller than the number suggests. This caught out both the dust and the
  core; the core is a mesh partly because of it.
- **Spikes are needles, not wedges.** An angular profile (`cos^n`) seems like
  the obvious way to draw a star and gets wider the further out it goes, so the
  spikes fatten into petals exactly where they should be narrowing.
- **Star density and field density are different problems.** The star needs
  enough points to fuse opaque at full-frame; that many spread across the field
  turn it into a flat starfield. Hence the shell that burns off.
- **`Galaxy` declares its own `boundingSphere`.** Three computes an
  InstancedMesh's bounding sphere lazily, once, from `instanceMatrix` — which
  starts collapsed inside the star. Left automatic, every node becomes
  unhoverable and unclickable as soon as the field expands past that sphere.
- **The camera is not driven by the `<Canvas camera>` prop.** R3F reads that once
  at creation; changing it later does nothing. `CameraRig` mutates the camera
  directly. Only the intro distance is measured (the star is tall, so a fixed
  number crops it on a portrait); the settled distance is free, because the field
  fits itself to whatever frame it is given.
- **The field is measured from the frustum every frame, not baked.** Its whole
  point is filling the top of the SCREEN edge to edge, and the frame's extents
  depend on aspect and on the camera's dolly — any fixed world size fills a
  widescreen and crops a portrait. It also can't be done by scaling a parent
  group, because the same points are the star at burst 0 and a non-uniform scale
  would squash it. So the field is stretched, the star isn't, and the two are
  interpolated in world space. See `fieldFrame` / `fieldPoint`.
- **The arc is the field's bottom edge, not its top.** Stars fill the whole top
  of the frame including the corners; the curve is where they stop. An earlier
  version had it the other way — a dome peaking at the centre — which
  necessarily leaves the top corners empty, since an arc that peaks in the
  middle must fall away at the sides.
- **A semicircle can't rotate.** The old layout was a tilted disc, which is
  rotation-invariant and so always reads as an ellipse. Rigid rotation destroys
  an arc, so the motion is a slow sway along each arc instead (`DRIFT_*`).
- **`HUB_CLEAR_PX` is deliberately tiny.** The arcs sweep through the centre, so
  a keep-out radius holds a small halo clear around the star. Sizing it anywhere
  near the category ring's radius shoves thousands of motes onto a single circle
  — punching an obvious hole in the field with a hard ring around it.
