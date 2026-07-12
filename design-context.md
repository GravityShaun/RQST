# RQST — Design Context

This document describes the complete visual language of the RQST mobile app (a live song-request app where fans pay to queue songs with DJs at venues). It is self-contained: every value below was extracted from the production UI code. Use it to design new screens that look native to this app.

---

## 1. App Visual Identity

RQST is a warm, tactile, "soft premium" interface: a putty-grey canvas layered with big rounded cards (16–40px radii), a single coral action color, and a quartet of pastel accent tones (peach-gold, mint, dusty rose, slate blue) used as tinted pill chips and solid feature tiles. Typography is Avenir Next in confident heavy weights — oversized 34–40px display headers, tiny uppercase letter-spaced eyebrows, and bold pill buttons — over subtle grain/noise textures, animated grainy gradients, and soft diffused shadows. Dark mode swaps the warm greige world for a deep navy-slate one while keeping the same coral CTAs and pill geometry.

---

## 2. Design Tokens

### 2.1 Color — Light theme (default)

| Token | Hex / value | Usage |
|---|---|---|
| Background | `#D7DBDE` | Screen canvas (cool putty grey) |
| Background secondary | `#E8EAEC` | Input fields inside cards, secondary buttons, detail tiles |
| Surface | `#F1F1F0` | Nested surfaces, close buttons inside modals |
| Surface elevated | `#FFFFFF` | Cards, modals, toasts, search fields, inputs |
| Surface muted | `#D3D0CC` | Toggle-off tracks, segmented control backgrounds, image placeholders |
| Border | `rgba(47,36,36,0.08)` | Hairline borders on nearly every card and input (1–1.5px) |
| Ink (primary text) | `#1E1717` | Titles, values, body on light surfaces (near-black warm brown) |
| Ink muted | `rgba(30,23,23,0.56)` | Subtitles, captions, labels, placeholders |
| Text (on dark/color) | `#FFF9F7` | Text on coral panels, dark buttons, selected states |
| Text muted (on color) | `rgba(255,249,247,0.74)` | Secondary text on colored panels |
| Coral (primary accent) | `#E05A47` | THE action color: CTAs, selected states, live badges, brand mark, alerts |
| Gold | `#F3C6A6` | Warm peach accent tone |
| Mint | `#ABDCCF` | Positive/success accent tone |
| Slate | `#E5A4A4` | Neutral accent tone (dusty pink in light mode — see flag below) |
| Ring pink | `#D84646` | Decorative offset ring on hero buttons |
| Metric tile | `#F6E3DD` | Blush background for stat tiles |
| Feature tile | `#FFB79A` | Peach background for feature tiles |
| Queue / venue card | `#F2EFEC` / `#F4EFED` | Warm off-white card variants |
| Rank badge | `#EFE2DE` | Pill behind queue rank numbers |
| Shadow | `#768190` | Shadow color for elevated cards (cool blue-grey) |
| Texture noise / crosshatch | `rgba(255,255,255,0.32)` / `0.30` | Screen background texture overlays |

### 2.2 Color — Dark theme

| Token | Hex / value | Usage |
|---|---|---|
| Background | `#0B1118` | Screen canvas (deep navy-black) |
| Background secondary | `#101A26` | Inputs, secondary buttons |
| Surface | `#152030` | Nested surfaces, queue/venue cards |
| Surface elevated | `#1C2A3D` | Cards, modals, search fields, metric tiles |
| Surface muted | `#243247` | Toggle tracks, rank badges |
| Border | `rgba(186,210,240,0.12)` | Cool blue hairlines |
| Ink (primary text) | `#E8F0FA` | Titles and values |
| Ink muted | `rgba(186,206,230,0.62)` | Subtitles and captions |
| Text (on color) | `#F0F6FC` | Text on coral/colored surfaces |
| Coral | `#E05A47` | Unchanged — same action color in both modes |
| Gold | `#C9A07A` | Desaturated bronze |
| Mint | `#7AB8A8` | Desaturated teal-mint |
| Slate | `#7A9BB8` | Blue-grey (genuinely slate in dark mode) |
| Feature tile | `#2A3440` | Dark slate tile |
| Shadow | `#000000` | Pure black shadows |
| Texture noise / crosshatch | `rgba(107,159,212,0.10)` / `rgba(186,210,240,0.12)` | Faint blue texture |

### 2.3 The four-tone accent system

Every chip, icon badge, tag, stat pill, and row icon takes one of four "tones". Each tone has a **solid** style (for tiles/buttons) and a **chip** style (translucent tinted pill). This is the app's core color-coding mechanic — statuses map to tones (played/complete → mint, cancelled/locked → coral, default → slate).

**Light-mode chip styles** (background / border / text-icon color):

| Tone | Chip background | Chip border | Chip ink |
|---|---|---|---|
| Gold | `rgba(242,198,166,0.18)` | `rgba(242,198,166,0.34)` | `#AE5A33` |
| Mint | `rgba(169,217,207,0.20)` | `rgba(169,217,207,0.34)` | `#225C4D` |
| Coral | `rgba(224,90,71,0.14)` | `rgba(224,90,71,0.28)` | `#B73524` |
| Slate | `rgba(226,170,177,0.18)` | `rgba(226,170,177,0.30)` | `#A3485B` |

**Dark-mode chip styles**:

| Tone | Chip background | Chip border | Chip ink |
|---|---|---|---|
| Gold | `rgba(201,160,122,0.28)` | `rgba(201,160,122,0.42)` | `#F3D4B0` |
| Mint | `rgba(122,184,168,0.30)` | `rgba(122,184,168,0.46)` | `#C8EDE4` |
| Coral | `rgba(224,90,71,0.28)` | `rgba(224,90,71,0.42)` | `#FFC4B8` |
| Slate | `rgba(122,155,184,0.28)` | `rgba(122,155,184,0.42)` | `#D4E4F4` |

**Solid styles** (same both modes — background / on-color ink): gold `#F2C6A6`/`#FFF7F1`, mint `#A9D9CF`/`#183630`, coral `#E05A47`/`#FFF3EE`, slate `#E2AAB1`/`#FFF7FF`. Solid surfaces get a `rgba(255,255,255,0.16–0.24)` 1–1.5px border.

### 2.4 Secondary accent colors (used in flows, not in the token file)

| Color | Usage |
|---|---|
| `#C95A52` | Coral-adjacent accent for small icons, active sort headers, pull-to-refresh spinner, cancel links (dark mode: `#FF9F8F`) |
| `#D94E3D` / `#D95E4F` / `#D8614F` | Deeper coral variants for solid circle buttons, hero panels, profile card |
| `#2F5FBE` ("site blue") | The money/contribution blue: contribute buttons, shoutout panel, "already in queue" banner. Tints: bg `rgba(47,95,190,0.08–0.12)`, border `rgba(47,95,190,0.16–0.32)` |
| `#5E78B8` | Softer blue for monetary amounts ("added" money, contributor totals) |
| `#A3485B` | Dusty rose for rank counts and pending statuses |
| `#4A5466` | Dark slate for the floating tab bar, map drawer header, and segmented tab containers (same in both modes) |
| `#ECEEF0` | Light-mode segmented tab container background |

⚠️ **Inconsistency flags**: coral drifts across `#E05A47` (token), `#D94E3D`, `#D95E4F`, `#D8614F` (solid buttons/panels), and `#C95A52` (icons/text). Dominant pattern: `#E05A47` for fills, `#C95A52` for small accents. The "slate" tone is dusty **pink** in light mode but blue-grey in dark mode. Use these as-is; do not normalize.

### 2.5 Typography

Font: **Avenir Next** on iOS for both display and body (Android: `sans-serif-medium` / `sans-serif`). There is no separate display face — hierarchy comes entirely from size and weight. Weights run heavy: 600 minimum for anything interactive, 700–800 standard, 900 rare emphasis.

| Style | Size / weight / line-height | Usage |
|---|---|---|
| Welcome display | 40 / 800 / 42 | Home screen brand title |
| Screen header | 34 / 800 / 40 | Page titles, auth titles, profile name |
| Hero title | 30 / 800 / 34 | Hero panel headline |
| Metric value | 28 / 800 / 32 | Big stat numbers; also 28/700 on mosaic cards |
| Section title | 25 / 800 / 30 | Section headings within a screen |
| Modal / drawer title | 22–24 / 800 | Sheet and modal headlines |
| Card title | 22 / 700 / 28 | Titles on cards |
| Sub-heading | 18–20 / 700–800 | Result sections, empty-state titles, amount options |
| Row / item title | 15–16 / 600–700 | List rows, song titles, search values |
| Body / subtitle | 14 / 400 / 19–20 | Section subtitles, descriptions |
| Small body | 13 / 400–600 / 18 | Row subtitles, captions, footnotes |
| Caption | 12 / 400–700 | Timestamps, stat captions, artist names |
| Micro label | 10–11 / 700–800, UPPERCASE | Field labels, detail-tile labels, statuses |
| Eyebrow | 11–13 / 700, UPPERCASE, letter-spacing 1–1.4 | Kicker line above titles |
| Table header | 9 / 700, UPPERCASE, letter-spacing 0.4 | Column headers |
| Button text | 14–16 / 700–800 | All buttons; small pills 11–12/800 |
| Tab bar label | 9 / 700 | Bottom tab labels |

### 2.6 Radii

Token scale: **sm 16 · md 24 · lg 32 · xl 40**, plus **pill 999** used constantly.

In practice: buttons/chips/tags/badges/toggles are always full pills (999); inputs and small tiles 14–18; cards 22–32; modals 24; bottom sheets 28 (top corners only); map drawer 34 (top); hero panels 40; song/album thumbnails 8–12; avatars fully circular.

### 2.7 Spacing

No named scale — a consistent step ladder is used: **2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24**.

- Screen horizontal padding: **20**
- Gap between screen sections: **16–18**
- Card internal padding: **18–22**, internal gap 10–14
- Row padding: 12–14 vertical; list item gap 10
- Bottom scroll padding: **112–132** (to clear the floating tab bar)
- Chip/pill padding: 12–18 horizontal, 8–14 vertical

### 2.8 Shadows & elevation

Shadows are soft, large-radius, low-opacity, and usually **cool-toned** (blue-grey `#768190` or `#5B6474` in light mode, black in dark):

| Element | Shadow |
|---|---|
| Elevated card | y=14, blur 28, opacity 0.11 |
| Search field / circle button | y=10–12, blur 18–22, opacity 0.08–0.12 |
| Hero panel | y=16, blur 30, opacity 0.18, color `#50606E` |
| Toast | y=8, blur 16, opacity 0.12, black |
| Bottom sheet | y=−12, blur 28, opacity 0.18 (upward) |
| Search bar shell (requests) | y=14, blur 28, opacity 0.22, color `#C8D8F1` (glows blue) |
| Selected/live glow | shadow in the accent color itself, e.g. coral y=0 blur 14 opacity 0.24 |

Every elevated surface also carries a 1–1.5px hairline border — border + soft shadow together is the signature card treatment.

### 2.9 Opacity conventions

- Disabled buttons: opacity **0.45–0.55** (or swap fill to `#B9B3AE` / `#5C5E6C`)
- Pressed avatar/images: **0.88**
- Pending action: **0.7**
- Muted text: always via rgba ink, never opacity on the element
- Frosted overlays on colored panels: white at 0.12–0.18 with white 0.14–0.24 borders

---

## 3. Component Library

### Buttons

- **Primary CTA**: full-width coral `#E05A47` pill (radius 999), 16px vertical padding, white 15–16/800 text, optional trailing `arrow-forward` icon, 8px gap. Disabled → grey fill `#B9B3AE` or 0.45 opacity. Pending → text swaps to a progressive verb ("Adding", "Requesting").
- **Auth submit**: same but radius 40, 1px `rgba(255,255,255,0.18)` border, 17/700 text.
- **Secondary button**: background-secondary pill, ink 14/800 text, sits beside primary in modal action rows (equal flex, 10px gap).
- **Blue contribute button**: identical geometry, `#2F5FBE` fill — used when adding money to someone else's request.
- **Hero rounded button**: cream `rgba(255,248,245,0.92)` pill, 18×14 padding, ink 15/700 text + icon, with a decorative oversized 2px pink `#D84646` ring bleeding past the edges (clipped).
- **Small pill button**: coral pill, 12×8 padding, min-width 76, white 12/700 text.
- **Circle icon button**: 48×48, radius 24, white elevated + hairline border + soft shadow, single 20px ink icon. Accent variant: solid `#D94E3D` with a light icon. Used in top bars.
- **Onboarding morph button**: 60×60 dark-ink circle that widens to a 148px pill on the last slide, white "Get started" 16/700 text.

### Chips, tags & pills

- **Tag**: pill, tone chip background + border, 12×8 padding, optional 14px leading icon, 12/700 tone-ink text. Used for statuses ("Live", "Open now", "Played"), filters, and eyebrow badges on heroes.
- **StatPill**: pill with 14×11 padding; 11/700 UPPERCASE tone-ink label over a 14/700 ink value.
- **Amount chip**: selectable pill, background-secondary + hairline; selected → solid coral, white text. Quick amounts render as `$5 / $10 / $15` rows with a "Custom" chip.
- **Rank badge**: `#EFE2DE` pill, 12×8 padding, "#3" in 13/700 ink.
- **Notification badge**: 20px coral circle, 1.5px cream border, white 11/800 count, overlapping the parent button's corner.
- **Context pill**: tiny metadata pill (venue, DJ, timestamp) — translucent white/ink tint, 9×6–7 padding, 11/700–800 muted text + 12px icon.

### Cards & tiles

- **SurfaceCard** (workhorse): white elevated, radius 32, 1.5px hairline, 18px padding, 14px internal gap, soft blue-grey shadow. Contains rows, section content, tables.
- **HeroPanel**: radius 40, solid deep-coral `#D8614F` or photo with `rgba(216,97,79,0.46)` coral wash, 1.5px white-alpha border, 22px padding, min-height 260. Contains: tag row (gold eyebrow tag + coral "Live now" tag), 30/800 white title, 14/400 white-82% subtitle, a row of frosted metric tiles (white-16% fill, radius 20, 12px padding: 18/700 value over 11 label), mint chips, and a hero rounded button. Decorated with faint rotated rounded-rectangle outlines ("accent pattern").
- **FeatureTile**: solid tone background, radius 32, 1.5px white-alpha border, 18px padding, min-height 164, flex tile. 38px frosted icon square (radius 16), 20/700 title, 13 subtitle at 0.9 opacity, bold value pinned to bottom. Same rotated-outline decoration.
- **MetricTile**: blush `#F6E3DD` tile, radius 24, hairline, 18px padding, min-height 146: 34px tone icon square (radius 14), 11 UPPERCASE muted label, 28/800 value, 13 footnote.
- **InsightBanner**: horizontal banner `#F2EEEA`, radius 24, 16px padding: 42px tone icon square, title 15/700 + subtitle 13, trailing 12/700 tone value.
- **VenueCard**: solid tone or photo (with tone wash at ~85% opacity), radius 32, min-height 220, 18px padding: "Live" tag + distance, 22/700 title, subtitle, stat columns ("Min request" / "Energy"), an 8px pill progress bar (white-28% track, tone fill), and tag row. All text in the tone's on-color ink.
- **QueueCard**: SurfaceCard variant on `#F2EFEC`: rank badge + status tag top row, 22/700 song title, 14 artist, stat columns ("Support" $ / "Fans in" count), momentum row with trending icon in tone ink.
- **Mosaic card** (home DJ pair): white elevated, radius 30, 12px padding, flex pair with 12px gap; 126px photo (radius 22, pastel peach/mint backing, faint dark wash), 28/700 title, 13 subtitle.
- **Request card**: translucent white `rgba(255,255,255,0.88)` (dark: navy 0.92), radius 22, 14px padding: 46px album art (radius 12), 16/700 title + 12 subtitle, status Tag, context-pill row, and a detail grid of small radius-16 stat tiles (10/800 UPPERCASE label + 12/800 value; the "total" tile tinted mint `rgba(184,235,221,0.44)`, "added" values in blue `#5E78B8`).

### Rows & lists

- **ActionRow / SettingsRow**: 44px tone icon square (radius 18), title 15/600 + subtitle 13/muted, optional 13/700 tone value, trailing muted `chevron-forward`. Rows stack directly inside a SurfaceCard (6px vertical padding, no dividers).
- **TimelineRow**: same at 38px icon, trailing 13/700 value instead of chevron.
- **ToggleRow**: ActionRow layout with a custom switch: 58×32 pill track (on = tone ink color, off = surface-muted), 24px white thumb, 4px inset.
- **Song result row**: 46px album art (radius 8), title 15/700 + artist 12 muted, trailing 32px status circle (background-secondary; selected = coral with white icon). Rows sit flush in a radius-16 bordered list container with no gaps.
- **Table list** (song queue): SurfaceCard at radius 22 / zero padding; header row on `rgba(30,23,23,0.06)` with 9px UPPERCASE sortable column labels (active = `#C95A52` + chevron); body rows 12×14 padding with hairline dividers: contributor count `#A3485B` 14/800 + 34px avatar (2px white border), song title 16/700 over artist 12, price 13/700 blue `#5E78B8`, and a 28px outlined circle button with a coral up-arrow.
- **Requester row** (in sheet): surface pill-card radius 18, 12px padding: 44px avatar, name 15/800 + @handle 13 muted, amount 15/800 blue, chevron.
- **Empty state**: centered, 24–28px padding: optional 32px muted icon, 16–20/700–800 title, 13–14 muted centered subtitle, optional coral pill CTA. Example: "No songs in the queue yet" / "Be the first song request in queue for this set."

### Inputs & search

- **Text field**: white elevated, radius 16, hairline border, 16×14 padding, 16/400 ink text, muted placeholder. Label above: 14/600 ink, 8px below-margin. Error: border tints coral `rgba(224,90,71,0.45)`, 13 coral message appears beneath. UPPERCASE 10–12/700 micro-labels are used instead for compact contexts ("CUSTOM AMOUNT").
- **Currency input**: pill-ish (radius 18) background-secondary row with a muted "$" prefix, 18/700–800 value text.
- **SearchField (display)**: white elevated bar, radius 24, 1.5px hairline, 12px padding, soft shadow: 44px coral-tinted icon square (radius 16, `rgba(224,90,71,0.08)` + `0.14` border), 11 muted label over 15/600 value, trailing 44px tinted options button.
- **Big search bar (request flow)**: white shell radius 30 with 3px inner padding (a pastel gradient border effect: peach `#FFD2C8` → pink `#F4B8CF` → lavender `#E8D9FF`), inner bar radius 26, min-height 64: 38px solid-coral circular icon badge, 17/700 input text. Shell glows with a blue-tinted shadow that intensifies on focus.
- **Segmented control**: pill container (`#ECEEF0` light / `#4A5466` dark, 4px padding, 4px gap); options are equal-flex pills; selected = solid coral with white text and a peach `rgba(255,198,166,0.72)` border. Text 12–13/800. Used for Search/Requested and Queued/Played tabs, theme picker, and sort toggles (a smaller radius-12 variant exists for sorting).

### Overlays

- **Toast**: floats at top (safe-area + 12, 16px side insets): white elevated, radius 24, 1px hairline, 16×14 padding, black shadow: 36px coral-tinted circle with a coral `musical-notes` icon, 15/700 title + 13 muted message, and either an outlined coral action pill (13/800 coral text) or a small × dismiss. Swipe up to dismiss. Success toasts fire a confetti burst (small falling rects in coral/gold/mint/white plus bright party colors `#00C805 #FFD700 #FF4757 #5352ED #FF6B81 #1DD1A1 #FF9F43 #A29BFE`).
- **Center-anchored modal card**: dark backdrop `rgba(30,23,23,0.4)` (dark mode `rgba(3,8,20,0.72)`), bottom-aligned white card radius 24, 20px padding, 14px gap: UPPERCASE 11/700–800 muted eyebrow, 22–24/800 title, 13–14 muted subtitle, 36px surface close circle top-right, content, then a full-width pill CTA.
- **Bottom sheet / drawer**: slides from bottom, top radius 28, white (dark: elevated navy), 42×5 grey pill handle centered at top, 18px side padding, min-height 58%, max 90%, upward shadow. Footer actions pinned at bottom with `margin-top auto`. Fine print 12/muted below CTA.
- **Map drawer**: persistent draggable sheet over the map: dark slate `#4A5466` handle header (56×5 white-36% handle, white 24/800 title, light-blue-72% eyebrow/subtitle), body in warm `#EFECE9`, top radius 34, spring-animated between a 230px peek and full height.

### Navigation chrome

- **Floating tab bar**: detached dark-slate `#4A5466` bar, radius 22, height 76, inset 8px from sides, hairline border. Five tabs: Home, Find, List, Request (center, emphasized), Settings. Icons 19px white; active tab icon sits in a 40px light `#D7DBDE` circle with the icon in coral. The Request tab is always a solid coral circle with a white `add` icon and a coral glow; active → periwinkle `#87A8D8`. Labels 9/700 beneath (active white, inactive `rgba(223,230,240,0.72)`).
- **In-screen top bar** (no native headers anywhere): row of 48px circle buttons left (sparkles accent button + search) and right (notifications with badge), followed by the header block.
- **ScreenHeader block**: 11/700 UPPERCASE letter-spaced muted eyebrow → 34/800 ink title → 14 muted subtitle, with an optional trailing element.
- **Avatar**: circular at any size; photo, or ink-filled fallback with the user's initial (white, ~38% of size, 700) or person icon; editable version adds a 32px coral camera badge at bottom-right corner.
- **Map markers**: 36px tone-colored rounded square (radius 18) with 2px white border, white radio icon, and a small triangular tail; selected grows to 42px.

### Decorative treatments

- **Background texture**: every standard screen has a faint white-noise wash + a 1px crosshatch line at ~0.3 opacity over the putty background.
- **Grainy gradient**: key emotional screens (auth, request flow) use an animated film-grain gradient of deep red `#b01818` → warm grey `#b3aeb9` → navy `#073990` (dark mode uses a dark variant). Subtle, slow, ambient.
- **Accent pattern**: colored panels carry 2–3 large rotated rounded-rectangle outlines in white-12–16%, plus a noise wash — like faded stickers.
- **Gradient-border pills**: identity chips (DJ / venue) use a 1.5–2px gradient border (peach-pink set `#FFD2C8→#F4B8CF→#E8D9FF` for DJ, blue-mint set `#A8D4FF→#7AB8A8→#D9F3F0` for venue) around a white pill inner (radius 999) containing a 10/700 UPPERCASE eyebrow + 15/700 value.

---

## 4. Screen Layout Conventions

- **Structure**: SafeAreaView → background texture → vertical ScrollView. Content: 20px horizontal padding, 18px gap between blocks, 12px top padding, 112–132px bottom padding to clear the floating tab bar. No native navigation headers — every screen builds its own top bar + header block. Edge-to-edge screens (map, photo heroes) skip the top safe-area edge and pad manually.
- **Rhythm**: screens read as a vertical stack of full-width rounded cards — top bar → display header → search → hero panel → tile pair (2-up flex row, 12px gap) → SectionTitle → SurfaceCard of rows → repeat. Sections are titled with the 25/800 SectionTitle + subtitle; optional right-aligned 12/700 muted action label.
- **Primary CTAs** live inside their context (bottom of a card, sheet footer) as full-width coral pills — never floating FABs (the tab bar's Request button is the global FAB).
- **Modal vs push**: money and pickers happen in bottom sheets/modals (slide-up, transparent backdrop); profiles and DJ pages push as full screens; auth is its own stack over the grainy gradient.
- **Pull-to-refresh** on data screens, tinted `#C95A52`.
- **Maps**: full-bleed dark-styled map with a floating search overlay (top, 20px insets) and the persistent slate drawer.

---

## 5. Motion & Interaction

- **Springs everywhere**: drawers and toasts settle with damping ~24, stiffness 220–260. Dismiss animations are 180ms ease-out-cubic timing.
- **Gestures**: toast swipes up to dismiss (with opacity tracking the drag); drawers drag with velocity-based snap (expand if flung up or past 55%); sheets use the standard slide `Modal` animation.
- **Loading**: `ActivityIndicator` spinners only — coral, centered for screen loads, small inline in buttons. No skeletons. Buttons show progressive-verb text while pending ("Adding", "Creating...", "Please wait...").
- **Press states**: minimal — most Pressables have no visual press feedback; avatars dim to 0.88. Selection state (solid coral fill) is the primary feedback.
- **Onboarding**: paginated slides with an animated dot pagination and the morphing circle→pill button (250ms). Map camera animates to regions over 450ms.
- **Celebration**: confetti burst overlays on success toasts.
- No haptics are used anywhere.

---

## 6. Copy & Voice Guide

- **Casing**: sentence case everywhere — buttons, titles, tabs, labels. Never Title Case. UPPERCASE is reserved for micro-labels/eyebrows (done via styling).
- **Buttons**: short verb-first imperatives: "Sign in", "Continue", "Open list", "Get started", "Confirm request", "Browse DJs & venues", "Add $10.00" (CTAs embed the live amount).
- **Eyebrows**: short scene-setting phrases: "Tonight near you", "Closest live room", "Welcome back", "Join the room", "Add to this song".
- **Subtitles**: complete, friendly sentences ending in periods, telling you what you can do: "Sign in to request songs, track your queue, and manage your account." / "The artist or DJ can choose to play each of the requested songs." / "Tell me when my songs move."
- **Errors**: calm and constructive, pattern "Could not X. Please try again.": "Could not sign in. Please try again." / "Could not add money to this song. Please try again." Validation: "Enter a valid email address." / "Password must be at least 8 characters." Guidance errors say what to do: "Choose a live show before adding songs." / "Sign in is required to add money to this song."
- **Empty states**: bold factual title + actionable next step: "No songs in the queue yet" → "Be the first song request in queue for this set."; "Find a live room" → "Tap the search icon above to browse DJs and venues, then open a live list."; "No DJs, artists, or venues match that search yet."
- **Domain vocabulary**: "rqsts" (paid requests), "room" / "live room" (venue session), "set" / "show", "queue", "add money" / "up-request" (contribute), "floor" (minimum amount), "shoutout" (paid DJ message), "DJs & artists".
- **Statuses**: single capitalized words: Open, Queued, Played, Pending, Canceled, Live.

---

## New User Journey Spec

[PASTE JOURNEY SPEC HERE]
