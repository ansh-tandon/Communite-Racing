# Communitie Racing Quiz League — UI Reframe Mega Prompt

> Paste this whole file into the build session. Fill in **§3 Reference Analysis** first (from screenshots of the three Dribbble shots). Everything else is ready to go.

---

## 0. Role

You are a senior product designer and frontend engineer. You are reframing the UI of an existing, working React app. You are **not** rebuilding the product. You change how it looks and feels, and you keep what it does.

---

## 1. Motivation: why we are reframing

The Quiz League works. Login, autosaving answers, deadlines, scoring, standings and admin all pass their tests. The current UI is a competent dark "F1 broadcast" skin: near-black panels, a red accent, Saira Condensed headings. But it reads like a **dashboard**, and the experience should feel like a **race weekend**.

What we want the new UI to do:

1. **Make every race feel like an event you're going to.** Motorsport ticket-booking apps are good at this. Hero photography, a big circuit name, the date and countdown up front, and one clear call to action ("Get tickets"). Our version of "buying a ticket" is **locking in your predictions**. The emotional beat is the same: *I'm in for this one.*
2. **Turn the prediction slip into a keepsake.** A ticket is a satisfying object. It has a stub, a perforation and a code. A completed quiz should end with a **Prediction Pass**: a ticket-styled card holding your picks, the race, the round and the lock time. Players want to look at it again, and they'll want to screenshot it later.
3. **Give each race a proper details page.** Race-details UIs show the circuit map, the key stats (laps, length, lap record), the weekend schedule and the session status in one scroll. Our Race Hub should feel that rich, while staying honest about the data we actually have.
4. **Be mobile-first for real.** Most players open this on their phone on a Saturday night before qualifying ends. The mobile ticket-booking pattern fits that moment: sticky bottom CTA, big tap targets, horizontal card rails and bottom sheets.
5. **Feel premium and of the community.** It should look like something a real paddock brand would ship, not a template. Then people share it, come back every round and trust the leaderboard.

**One-line brief:** *Take the visual language of a premium motorsport ticket-booking app and apply it to a race-prediction league. The race is the event, the quiz is the ticket, the leaderboard is the grandstand.*

---

## 2. References

| # | Shot | What we take from it | Maps to our screen |
|---|---|---|---|
| R1 | [Motorsport Ticket Booking – Mobile UI](https://dribbble.com/shots/27616123-Motorsport-Ticket-Booking-Mobile-UI) | Mobile flow: race cards, picking options, the ticket/confirmation object, bottom CTA, bottom sheets | `/quiz/:id` Quiz Arena, completion → **Prediction Pass**, `/races` on mobile |
| R2 | [Motorsport Ticket Booking – Homepage](https://dribbble.com/shots/27622784-Motorsport-Ticket-Booking-Homepage) | Hero composition, headline type scale, upcoming-events rail, section rhythm, nav | `/` Home, `/races` calendar |
| R3 | [Motorsport Race Details UI](https://dribbble.com/shots/27609405-Motorsport-Race-Details-UI) | Circuit map treatment, stat blocks, schedule/timeline, tabs, status chips | `/races/:id` Race Hub (Overview / Predictions / Results) |

**How to use the references:** borrow **visual language** (type, colour, composition, components, motion). Do **not** borrow the **domain**: no seats, stands, prices, cart, checkout or payments. Every ticketing pattern has to be translated (see §5).

---

## 3. Reference Analysis (FILL THIS IN BEFORE BUILDING)

> Dribbble blocks automated fetching, so this section is filled in by hand from screenshots. Replace every `TBD`. Where a value conflicts with §6 (tokens), **this section wins**.

### R1 — Mobile ticket booking
- Background / surface colours: `TBD`
- Accent colour(s) and where they're used: `TBD`
- Display font (or closest Google Font): `TBD` · Body font: `TBD`
- Headline style (case, weight, tracking, size relative to screen): `TBD`
- Card shape (radius, borders vs shadows, image bleed): `TBD`
- Ticket/confirmation object (stub, perforation, barcode/QR, layout): `TBD`
- Selection UI (chips, grid, seat map, stepper): `TBD`
- Bottom CTA / bottom sheet behaviour: `TBD`
- Imagery (car photos, cut-outs, blur, duotone, grain): `TBD`
- Distinctive details worth stealing: `TBD`

### R2 — Homepage
- Hero layout (full-bleed photo? split? giant type behind car?): `TBD`
- Nav style: `TBD`
- Events/race list pattern (rail, grid, list rows): `TBD`
- Section spacing and rhythm: `TBD`
- Distinctive details worth stealing: `TBD`

### R3 — Race details
- Circuit map style (stroke weight, glow, sector colours, start marker): `TBD`
- Stat block style (number size, labels, dividers): `TBD`
- Schedule/timeline pattern: `TBD`
- Tabs/segmented control style: `TBD`
- Status chips (live / upcoming / finished): `TBD`
- Distinctive details worth stealing: `TBD`

### Synthesis (one paragraph)
`TBD` — The single visual idea that ties all three together, e.g. "giant condensed italic type behind cut-out car photography, a warm-black base, one hot accent, and ticket-stub geometry used as a repeating motif."

---

## 4. Hard constraints (do not break)

**Stack:** keep it. React 18 + Vite + TypeScript + Tailwind + TanStack Query + React Router, in `quiz-league/frontend`. No new UI framework. Small, well-justified additions (e.g. `framer-motion`) are fine. Say why in the summary.

**Behaviour stays identical:**
- Routes stay the same: `/login`, `/`, `/races`, `/races/:id`, `/quiz`, `/quiz/:id`, `/standings`, `/profile`, `/admin`, `/admin/new`, `/admin/races/:id`.
- Answers **autosave** and **lock at the closing time**. There is **no Submit button**. The "Lock in" moment is a *visual* confirmation of the autosaved state, not a new API call.
- Email OTP login (6 digits; `000000` = wrong code in demo).
- Question types: Pick one, Pick several (`pick: n`), Put in order (`pick: n`), Number (`min/max/tolerance`), Yes/No. Every one needs a designed input.
- `src/api/*`, `src/hooks/*`, `src/demo/*` and `src/utils/answers.ts` keep their contracts. Restyle components and pages, not data flow.
- **Demo mode** (`VITE_DEMO=true`) keeps working, with its banner and "Reset demo".
- All existing tests (`npm test`) keep passing. Update selectors only if markup changes, and never weaken assertions.

**Honesty rules (from `frontend/BACKEND_GAPS.md`):** the UI never fakes data. If the backend doesn't serve it, design a tasteful "not available yet" state:
- No real circuit images, lap counts or lengths → use the abstract track line plus available fields, and leave stat slots designed but hidden or "—".
- No session schedule → show the quiz window only, with a quiet note.
- Driver list/team colours come from `src/fixtures/drivers.ts` (dev fixture).
- No standings movement arrows. No badges shown as earned.

**Out of scope:** membership, payments, coupons, badges awarding, community feed. Don't design checkout or pricing, even though the references are ticketing apps.

---

## 5. Translation table: ticketing → prediction league

| Ticket-booking pattern (references) | Our equivalent |
|---|---|
| "Upcoming events" rail | Upcoming rounds rail (round no., GP name, country flag/code, date, quiz status) |
| Event hero + "Get tickets" | Next-race hero + countdown + **"Make your predictions"** / "Continue predictions" / "View results" |
| Choose stand / seat map | Driver grid (Pick one / Pick several), drag or tap-to-rank podium (Put in order) |
| Ticket tier cards | Question cards with points value as the "tier" |
| Quantity stepper | Number question input (respects min/max) |
| Checkout progress steps | Question progress segments (Q3 of 8), answered/unanswered state |
| Order summary sheet | "Your picks" bottom sheet (review all answers before the deadline) |
| Booking confirmed + e-ticket | **Prediction Pass**: ticket card with race, round, picks, "Locks at 18:30 IST", pass code (race id + user initials), perforated stub |
| My tickets | Profile → past passes, each with points scored once results are published |
| Event details page | Race Hub: circuit line, stats, quiz window, tabs |
| Sold out / sales closed | Quiz closed / locked state (picks frozen, pass shows "LOCKED") |
| Grandstand / venue map | Leaderboard as the "grandstand" (top-3 podium + rows) |

---

## 6. Design system (starting tokens; §3 overrides)

Rewrite `tailwind.config.js` and `src/styles/index.css` around these roles. Keep token *names* semantic so components don't hard-code hex.

- **Direction (taste-skill, seed 1129384555): "The name as a monument."** Each Grand Prix name is set at poster scale as the hero. Everything else stays small and calm. **Type (user's choice, 2026-10-19):** headlines in **PP Formula Condensed Black** (Pangram Pangram, commercial; needs a web licence, and the `@font-face` is ready in `src/styles/index.css`). Until it's licensed, **Barlow Condensed Black** stands in. The whole interface is in **Titillium Web** (Google Fonts, OFL). Headline weight 900, body 400/600/700. The dealt photographs (interiors and tabletops) were redrawn because they have nothing to do with racing. Sheet: `quiz-league/frontend/.taste-skill/direction.json`.
- **Brand palette (taken from the logo):** ground `#0A0A0A`, ink `#FFFFFF`, accent `#E10600`, exactly the red of the "A" in RACING. The accent goes on the one action per screen.
- **Brand mark:** the red A, cut from the logo, on `#0A0A0A`. It's the favicon, the home-screen icon and the Android icon (`public/favicon-32.png`, `apple-touch-icon.png`, `icons/*`). The full wordmark stays `cr-logo-white.png`, and the large A is in `public/cr-mark-a.png`.
- **Colour roles:** `bg`, `surface`, `surface2`, `line`, `ink`, `muted`, `faint`, `accent` (+`hi`/`lo`), `ok`, `warn`, `live`. One dominant accent. Team colours appear only on driver elements.
- **Type:** one condensed display face for race names, numbers and labels (current: Saira Condensed; swap if §3 names a better match) plus one neutral sans for body (Inter). Tabular numerals everywhere numbers change (countdowns, points, positions). The display scale needs a real "poster" size for hero GP names, around 18–22vw on mobile, clamped on desktop.
- **Shape:** pick one radius family and use it everywhere. Ticket notches (half-circle cut-outs) and perforated dividers are a **signature motif**. Use them on the Prediction Pass, race cards and the hero CTA strip, nowhere else.
- **Depth:** prefer contrast and borders over heavy shadows. A single soft glow for the active/selected state.
- **Imagery:** there are no circuit photos from the backend. Use `public/hero-grid.jpg` for the home hero, and abstract track lines, carbon/grain textures and gradients elsewhere. Never use stock photos of specific real drivers.
- **Iconography:** one icon set, one stroke weight.

---

## 7. Screen-by-screen spec

Design **mobile (390px) first**, then tablet (768) and desktop (1280+). Each screen needs loading (skeleton), empty, error and populated states.

### 7.0 The globe (built 2026-10-18)
`src/components/ui/wireframe-dotted-globe.tsx` (d3-geo on a canvas, loaded lazily through `src/components/LazyGlobe.tsx`) is the app's F1 signature. It shows the race's circuit pinned and labelled, the season's circuits as dots joined in round order, and the leg into the pinned race in the accent red. It's used on:
- **Login:** the whole calendar, turning slowly. Right half on laptops, above the form on phones.
- **Home hero:** the next race, flying in and pinned beside the race name.
- **Quiz:** each time a quiz is opened, the globe flies to the circuit beside the race name and a Start/Continue button. Once inside, a small pinned globe sits in the sidebar.

Drag turns it with a mouse or touch. On phones a vertical swipe still scrolls the page. There's no wheel zoom (that would hijack scrolling). Reduced motion turns off the fly-in and the drift. Coordinates come from a fixture until the backend serves them (`BACKEND_GAPS.md`).

### 7.1 Login `/login`
**Built 2026-10-19:** one composition, not two halves. The calendar globe is the main visual. The form sits directly on the same backdrop with no card box: no border, panel, beams or tilt. Logo, form and footer share one left edge, and a single red glow spans the globe and the form. Desktop: form left, globe right, one screen tall. Phones: globe, caption, form, stacked. Only the shimmering red submit button is kept from "sign in card 2" (`src/components/ui/sign-in-card-2.tsx`). The sign-in is still email + 6-digit code only (no password, Google or sign-up links, because the backend doesn't have them). The red A badge and start lights were removed from the form at the user's request; the blinking rain light stays. Card and globe share one full-page backdrop: Red Bull Racing's official GIPHY clip (loaded from GIPHY, credited in the footer), greyscale, darkened and slowed to 0.7×, with a vignette. A still frame replaces it under reduced motion or data saver. The source is only 480×270, so it's deliberately kept dark and atmospheric. No watermark or logo is removed from any footage.

**Changed 2026-10-19 (after the first phone tests):**
- **Headline:** "PREDICT THE RACE. / OWN THE GRID." with a masked line reveal.
  - Each line slides up out of its own `overflow-hidden` mask while fading in: 380ms, line 2 starting 200ms after line 1, no overshoot.
  - It starts once the fonts are in, so the reveal isn't spent while the page is still loading. It never waits more than 700ms.
  - Plays once per page load. Reduced motion shows it at once, and nothing shifts.
  - 44px, scaled down to fit a 320px iPhone SE.
- **Racing name, typed with the email:** the first screen asks for the racing name above the email.
  - It's saved as soon as the code is accepted (`PATCH /auth/me`; 2–24 characters, spaces tidied, the backend's rules).
  - A returning player can leave it blank to keep their saved name.
  - A new player who leaves it blank is asked once more after the code, with no skip.
  - The old "Set your name" detour to Profile is gone.
- **Globe:** sized by width on phones (about 90%), and beside the form on a phone held sideways.
- **Background clip:** marked muted the way iOS requires before it will autoplay (no play button), and restarted whenever Safari stops it at the end of a loop. The still frame stands in if iOS refuses to play (Low Power Mode).
- **Tested** on iPhone 13 and SE (WebKit), Android Pixel 7 and a 320px Android (Chromium), and desktop Chrome/Edge and Safari.
- **Lights out after sign-in:** our own start sequence, drawn and voiced in code (no footage).
  - Five red lights come on a second apart with a beep each. After a random 0.7–1.5 s hold they all go out with a higher tone, then "Lights out / And away we go." shows and the app opens, about 7 s in all.
  - The sound is Web Audio, unlocked by the taps on the way in (send code, code digits, name). Without sound support the lights run silently.
  - Skip, Esc, and a sound on/off button (remembered).
  - Reduced motion: no lights, a short "Lights out" and in.
  - A Netflix start-lights clip was tried and dropped at the user's request. Its watermark was never removed or hidden.

Original brief: full-bleed hero image/texture, logo, a one-line hook ("Predict the race. Beat the paddock."), email field, then a 6-box OTP input with paste support. Resend cooldown 30s. 429 explained in plain words. Should feel like the app's "gate". Footer carries the "Unofficial fan community" line.

### 7.2 Home `/` (R2)
**3D circuit in the hero (approved by the user 2026-10-19):** on Home only, after login, the hero shows the featured race's circuit in 3D instead of the globe.
- **Component:** `src/components/ui/circuit-3d.tsx`, loaded lazily through `LazyCircuit` in `LazyGlobe.tsx`. It's drawn the way the globe is: a canvas over a dot-matrix ground.
- **Look:** the track is a raised slab with lit edges, red and white kerbs on the tighter corners and a chequered start line. "Start / Finish" and "Turn 1" chips, and a red light running the lap in the racing direction.
- **Motion:** it flies in, then sways; drag turns it (vertical swipes still scroll on phones). Paused off screen, still under reduced motion.
- **Data:** outlines are in `src/fixtures/tracks.ts`, from f1-circuits (MIT, notice included). Only Austin (COTA) so far.
- **Fallback:** a race without an outline shows the globe. Login, the quiz intro and the quiz sidebar always keep the globe.
- **Honest limits:** it's drawn flat (no elevation in the data), and the track is drawn wider than life so it reads on a phone.

- **Hero:** next race. Giant GP name, round number, country, date range, live countdown to quiz close (or to quiz open), and a primary CTA whose label depends on state: *Make your predictions* / *Continue (5 of 8 answered)* / *Picks locked* / *See results*.
- **Your pass strip:** if the player has started, a mini Prediction Pass preview.
- **Upcoming rounds rail:** horizontal cards with snap scrolling, status chips.
- **Standings preview:** top 3 as a mini podium + your position.
- **Your stats:** points, rounds played, best finish (only what the API returns).

### 7.3 Races `/races` (R2 + R1)
Season calendar as stacked ticket-style cards: round, GP name, circuit, date, status chip (Upcoming / Open / Locked / Scored). Filter chips: All · Open · Completed. Past rounds show your points on the stub.

### 7.4 Race Hub `/races/:id` (R3)
- Header: GP name (display size), round, country, status chip, countdown.
- Circuit block: abstract `TrackOutline` styled like R3's map (stroke, glow, start marker). Stat slots for laps/length/lap record show "—" with a quiet "Circuit data coming soon" note (see gaps).
- Quiz window timeline: Opens → Closes → Results (published / pending review).
- Tabs: **Overview · Predictions · Results**, styled after R3's segmented control. Predictions shows your picks (or a CTA). Results shows the answer key vs your picks, points per question, and the race leaderboard.

### 7.5 Quiz Arena `/quiz/:id` (R1, the core screen)
- Top: race name, compact countdown, save indicator ("Saved · 2s ago" / "Saving…" / "Offline, will retry").
- Progress segments, tappable to jump between questions.
- One question per view on mobile (swipe or next/prev), all questions in a scroll on desktop.
- Inputs:
  - **Pick one:** driver card grid (number, code, name, team colour bar). The selected card gets the accent glow.
  - **Pick several:** same grid with a "2 of 3 picked" counter. Disable extra picks with an explanation.
  - **Put in order:** P1/P2/P3 podium slots. Tap a driver to fill the next slot, drag to reorder, tap a slot to clear.
  - **Number:** big stepper plus direct input, with the min/max shown and the tolerance explained ("±1 counts").
  - **Yes/No:** two large split buttons.
- Points badge on each question ("10 pts", "All-or-nothing").
- **Sticky bottom bar:** "Review picks" opens the bottom sheet summary. When everything is answered it reads "View your Prediction Pass".
- **Locked state:** inputs disabled, a "Picks locked at 18:30 IST" banner, and the pass shown.

**Built 2026-10-19:**
- **Phones:**
  - The question sits straight on the page; from tablet up it gets one sheet. No boxes inside boxes.
  - The header carries the race name, a "Locks in" countdown, the save state and "Q2 of 7". The sidebar (globe, stats, question list) shows only on laptops.
- **Progress segments:** thin bars inside 44px tap targets.
- **Inputs:**
  - Drivers are 2 to a row: car number in team colour, surname (full name from 640px up), code and team.
  - Podium steps have 44px "move up" and "remove" buttons.
  - Number has a styled slider with the min and max shown; the middle value is grey until the player sets it or taps "Go with 16".
  - Pick several says "3 of 3 picked. That's all of them; tap a pick to free a place."
- **One per view on every size** (arrow keys work on laptops), not the all-in-one scroll for desktop asked for above.
- **No "Review picks" bottom sheet.** The last "Next" opens the Prediction Pass (`?q=done`), and every line on the pass opens its question. This keeps the Android back button working.
- **Look:** corners tightened app-wide to match the login screen (controls 6px, cards 10px, sheets 12px), and the primary button lost its red glow.

### 7.6 Prediction Pass (new component, R1's ticket)
**Built 2026-10-19** in `src/components/pass.tsx`:
- **Layout:**
  - Header: "Prediction Pass", a status stamp (Open / Locked / Scored / Not open), the round and the GP name at poster size.
  - One line per question, with drivers as code chips edged in team colour and points per line once scored.
  - A perforation with two notches, then the stub: lock time, player, the pass code `R18-004-Y` (round, race id, initials), and the total and place once scored.
- **Motion:** the stub settles in after the pass (about 450ms, none under reduced motion).
- **Where it shows:** it's the quiz's last screen, beside "4 still to answer" / "Predictions in" / "Picks locked" / "Your result".
- **Still to do:** the pass strip on Home and "My passes" on Profile.

Ticket card: header with GP name and round, a body listing each question → your pick (drivers as code chips in team colour), a perforated divider, then a stub with lock time, player name, pass code and status (OPEN / LOCKED / SCORED + points). Animate in on completion (the stub "tears" or slides, ~400ms). Must look good as a phone screenshot at 390×844. Don't add a share/download button yet. Just make it screenshot-worthy.

### 7.7 Standings `/standings`
Grandstand feel: top-3 podium with heights and positions, then rows with position, avatar, name, points and rounds played. Your row pinned at the bottom if it's off-screen. Client-side search. No movement arrows (not in the API).

**Built 2026-10-19 (timing-tower redesign):**
- **Header:** "2026 Championship · after round 17" with "Standings". The intro paragraph is gone.
- **Summary strip:** Leader, Points, Gap to P2 and You, separated by hairline dividers.
- **Podium:** one stepped block (P2 | P1 | P3) in gold, silver and bronze. The colour comes from the rank, so a tie for P2 shows two silvers. Each step shows the gap to the leader.
- **Timing tower:** Pos, +/−, Player, Races, Wins, Gap and Pts. On phones it's Pos, +/−, Player (with races and wins) and Pts (with the gap). Rows are divided by thin lines rather than cards.
  - Tied ranks read "=2".
  - A medal-coloured bar marks the podium rows, and a racing-red bar and tint mark your row.
- **Your row:** pinned to the bottom of the screen whenever it's off it; tapping it jumps there. Search, Find me and pages are kept.
- **Movement:** real data, not invented. The standings without the latest scored round's points (from `/races/:id/leaderboard`) are ranked the way the backend ranks (points; ties share a rank) and compared with today's ranks. A player whose only race is that round shows "New". It's tested in `leaderboard.test.ts`.
- **Laptops:** the summary and podium are on the left and sticky, with the tower on the right.
- **Podium polish (2026-10-19):** P1 is the focal point.
  - Bigger avatar with a gold ring, 44px points, the tallest step with a red-and-white kerb along its top, and a faint checkered corner.
  - Silver and bronze rings and steps for P2 and P3. A dashed track-edge baseline.
  - The DOM lists P1, P2, P3 in rank order; the grid shows P2 | P1 | P3.
- **Entrance:** plays once, when the podium comes into view.
  - P2 and P3 steps rise from the baseline, then P1 (420 ms each, no overshoot). Names and points fade up behind them, and the points count up to the real totals. All landed by about 600 ms.
  - Then one gold sweep across P1's step and a brief glow on its ring.
  - The ▲/▼ shows only real movement since the last scored round.
  - Reduced motion shows the final state at once.
  - The name and points fade is CSS, not framer-motion, because Safari blinked for a frame when framer handed back a finished fade.

### 7.8 Profile `/profile`
Player card (name, email, season points, best finish), then **My passes**: a list of past Prediction Passes, newest first. Badges section stays as "not switched on yet".

### 7.9 Community (removed 2026-10-19)
The `/community` page was removed at the user's request. The route now shows "Off track", and the nav has four tabs. The "Watch the race with us" panel and the leaderboard preview were later removed from Home too (user's request, 2026-10-19).

**Dates (2026-10-19):** every date and time is shown in IST ("Mon, 26 Oct, 1:30 am IST"), whatever the device's clock says (`utils/format.ts`).
- **Race cards:** open and upcoming cards show the race's lights-out time, which is when the quiz locks.
- **Demo races:** they follow the real revised 2026 calendar from Baku (round 15) to Abu Dhabi (round 23). Saudi Arabia was cancelled, and the Bahrain GP was held at Sepang on 4 Oct.
  - Times are the official start times.
  - Each quiz opens a week before lights out.
  - Races already run when the demo starts are scored.
- **Still in doubt:** Qatar and Abu Dhabi as of October 2026, with Imola on standby.

### 7.10 Admin `/admin*`
Functional first. Apply the tokens and components but keep it dense and clear: race list, new race form, question editor, answer-key entry, Save draft vs Save & Score, Publish, Re-score with confirmation dialogs. No ticket theatrics here.

### 7.11 App shell
**Changed 2026-10-19 (user's request):**
- **Three items:** the nav has only Home, Quiz and Leaderboard. Races stays a page, reached from Home's "All races" and from race links.
- **No wordmark text:** "Quiz League" was removed from beside the logo.
- **Laptop top bar:** follows shadcn "navbar-02" (`src/components/ui/navbar-02.tsx` on Radix NavigationMenu, `ui/navigation-menu.tsx`). The logo has the links beside it as pills, and the current page gets a filled pill. The account menu is on the right.
- **Left out of navbar-02:** its Sign in/Sign up and theme buttons (players are signed in; the app is dark only).
- **Phones:** the bottom tab bar has the same three tabs, instead of navbar-02's menu sheet.
- **Mobile:** bottom tab bar (Home · Races · Quiz · Standings · Profile) with the active indicator in the accent colour, and safe-area padding.
- **Desktop:** top bar with logo, nav and account menu.
- Demo banner stays visible but unobtrusive.
- Keep the `StartLights` loader moment and restyle it. It stays the loader for routes and data.

---

## 8. Motion

- Purposeful and quick: 150–300ms for UI, 400–700ms for "moments" (pass reveal, podium grow, hero entrance).
- Signature moments: the countdown digits roll, the selected driver card snaps, podium bars grow, the pass stub tears.
- Respect `prefers-reduced-motion` (the global rule already exists, keep it).
- No scroll-jacking, no parallax that hurts mobile performance.

### 8.1 Intro animation (LottieFiles), removed 2026-10-19
**Removed at the user's request.** The F1 car intro no longer plays. `IntroGate`, `IntroSplash`, `introEdges.ts`, `public/animations/f1-intro.lottie` and the `@lottiefiles/dotlottie-react` package are gone, and the login headline reveals as soon as the page loads. The notes below are kept only as a record of what it was.


**Source:** [F1 logo animation by shivi badaya](https://lottiefiles.com/free-animation/f1-logo-aniamtion-qYUcBasNzI), free under the [Lottie Simple License](https://lottiefiles.com/page/license). Credit the creator in the login footer (the Community page it was planned for has been removed).

**Why it's here:** it is the "lights out" moment. Opening the app should feel like the start of a broadcast. A car tears across the screen, the logo lands, the screen goes to black, and you're in the paddock. It sets the race-weekend tone (§1) before the player sees a single card.

**What the file actually is** (checked, so build around these facts):

| Property | Value |
|---|---|
| Format | dotLottie v2 (`.lottie`, a zip), one animation `Main Scene` + one state machine (autoplay, loop) |
| Canvas | 512 × 512, 30 fps, 228 frames ≈ **7.6 s** |
| Content | **107 raster WebP frames** (720 × 405, 16:9), not vector shapes, so colours/logo **cannot** be recoloured or edited |
| Background | **Opaque, no alpha.** Starts pure white `#FFFFFF`, goes light grey `#D2D2D2` around the logo, then **fades to pure black `#000000`** on the last frames |
| Story | White track with red/white kerbs → red car drives in → official F1™ logo lands as the car passes → motion-blurred car → fade to black |
| Weight | ~367 KB (the `.lottie` file) |
| Download | `https://assets-v2.lottiefiles.com/a/a9b9a3dc-eccd-40a4-863b-13c57b69cd5d/qYUcBasNzI.lottie` |

**Where it plays:**
- **Session intro splash.** Plays once per browser session on first app load (logged in or on `/login`), full-screen, then hands off to the app. Remember "played" in `sessionStorage` (wrapped in try/catch; if storage fails, just play it).
- **Not** the general loading indicator. It's too long and too heavy for that. `StartLights` stays the loader for route/data loading.
- **Not** the app logo, favicon, app icon or nav mark. Our brand is Communitie Racing (`cr-logo-white.png`).

**How it plays:**
1. The splash container background starts `#FFFFFF` so the first frame is seamless. Letterbox the 16:9 frames with `object-fit: contain` behaviour and fill the bars with the same white.
2. Override the file's state machine. **Play once, no loop** (`loop={false}`, `autoplay`).
3. As the animation fades to black, cross-fade the container background to `#000000`. On the `complete` event, fade the splash out over 300ms into the app's `bg` token (near-black), so the handoff is black → near-black with no flash.
4. **Skippable:** a visible "Skip" button (bottom-right, 44px target, keyboard focusable) plus tap-anywhere and `Esc`. Skip jumps straight to the fade-out.
5. **Never blocks the app.** The app mounts and fetches underneath. If nothing is playing 2.5 s after page load, skip. Once playing, a cap of about 9.7 s (counted from the start of playback, so a slow load can't cut it short) removes the splash even if `complete` never fires. If the file fails to load, skip silently.
6. **Reduced motion:** if `prefers-reduced-motion: reduce`, don't play it at all. Go straight to the app.
7. **A11y:** the animation is `aria-hidden="true"`. The splash has a visually hidden "Loading Communitie Racing" live region. Focus moves to the app's main heading after the handoff.

**Implementation:**
- The file is **already in place** at `frontend/public/animations/f1-intro.lottie` (the original, unmodified). Self-host it. Never hot-link LottieFiles' CDN at runtime.
- Use `@lottiefiles/dotlottie-react` (the official dotLottie player). Load the `IntroSplash` component with `React.lazy` so the player and file stay out of the main bundle.
- Don't apply CSS `filter: invert()`, blend modes or recolouring to make it "fit" the dark theme. It's raster, and that wrecks the red. The white → black arc **is** the transition into the dark UI.
- Respect the `VITE_DEMO` banner: show it after the splash, not on top of it.

**Built (2026-10-18):** `src/components/IntroGate.tsx` (decides once per session, lazy-loads) and `src/components/IntroSplash.tsx`.
- **Our logo lands last.** After the animation fades to black, the Communitie Racing wordmark scales in on black for 1.1 s, then the splash fades into the app. The F1 mark is never the last thing the player sees.
- **Any screen shape:** the 16:9 band fits the screen ("contain"). The bars above and below take the frame's own top and bottom edge colours, frame by frame (`introEdges.ts`, sampled from the file), so on a tall phone it still reads as full-screen.
- **Render size capped** at about 1440 px of canvas width (the frames are only 720 px wide, and iOS limits canvas area).
- **Renderer self-hosted:** the player's WASM file is bundled and served by the app, not fetched from a CDN.
- **Testing:** `?intro=1` forces the intro and `?intro=0` skips it. It's also skipped for automated browsers (`navigator.webdriver`), so screenshot tools see the app.

**⚠ Trademark note (read before shipping):** the frames contain the **official Formula 1 logo (™)** and an F1 car styled in a team's red. The Lottie licence covers the animation file. It does **not** grant rights to the F1 trademark. This is an unofficial fan league, so:
- Use it only as the intro moment, never as our branding (see above).
- Add a quiet line to the login footer and Community/About page: *"Unofficial fan community. Not affiliated with Formula 1 or the FIA."*
- Build `IntroSplash` so the animation source is one constant, which makes it easy to swap for a non-trademarked animation later (e.g. our own CR mark with the same car-pass motion) if the community grows or anyone objects.

---

## 9. Accessibility and quality bar

- WCAG AA contrast for all text. Never rely on colour alone (team colour always comes with the driver code).
- Every input is keyboard operable. The Put in order input needs a non-drag way (buttons to move up/down).
- Visible focus ring. Tap targets at least 44px.
- Times shown in IST with the label.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95.
- No layout shift on countdown ticks (tabular numerals, fixed widths).

### 9.1 iOS, Android and desktop web, on every screen

Every screen must work and look designed in: **iOS Safari** (iPhone 375–430 wide, iPad), **Android Chrome** (360–412 wide, gesture and three-button navigation), the **installed home-screen app** on both, and **desktop** Chrome, Edge, Safari and Firefox (1280–1920+).

- **Height:** use `dvh`/`svh`/`lvh` for full-height layouts, never `100vh` (the iOS toolbar changes the height).
- **Safe areas:** `viewport-fit=cover` is set. Pad the top bar (installed app), bottom tab bar, sticky quiz bar, bottom sheets and any fixed button with `env(safe-area-inset-*)`.
- **Touch:** targets at least 44×44 (48 where there's room, Android's size). Nothing works only on hover. Wrap hover styles in `@media (hover: hover)`. Give every control its own pressed state and `touch-action: manipulation`.
- **Inputs:** input text 16px or more (iOS zooms in on anything smaller). Set the right `type`, `inputmode`, `autocomplete` and `enterkeyhint`. The OTP field uses `autocomplete="one-time-code"` so iOS and Android can autofill the code.
- **On-screen keyboard:** the bottom tab bar and sticky quiz bar must never cover a focused input. Hide them while an input has focus on mobile.
- **Scrolling:** rails use `scroll-snap` with momentum. Sheets and dialogs lock the page underneath (in a way that also works on iOS) and use `overscroll-behavior: contain`. No scroll-jacking.
- **Drag (Put in order):** pointer events, not mouse events, so it works with touch. The move-up/move-down buttons stay as the fallback.
- **System gestures:** no horizontal swipe handlers that start within 20px of the screen edge (iOS swipe-back, the Android back gesture). The Android back button closes an open sheet or dialog before it leaves the page (push a history entry when it opens).
- **Times:** always IST with the label, formatted with `Intl` and an explicit time zone, never the device's default.
- **Installable app:** manifest, icons (192, 512, maskable 512, apple-touch-icon, 32px favicon) and `theme-color #0A0A0A` are in place. The iOS status bar style stays `black` until the top bar pads `env(safe-area-inset-top)`. Then switch to `black-translucent`.
- **Check every screen at:** 360×800 (Android), 390×844 (iPhone), 430×932 (large phone), 844×390 (phone landscape, for the quiz and login), 768×1024 (tablet), 1280×800 and 1440×900.

**Done in the shared app shell (2026-10-19), so every logged-in screen gets it:**
- The top bar is one sticky block that starts below the status bar/notch (`env(safe-area-inset-top)`). The iOS status bar is now `black-translucent`. Side gutters (`.px-safe`) clear the notch in landscape.
- `--tabbar` (index.css) is the phone tab bar's height including the home-indicator area: 0 on laptops, and 0 while typing. The page padding, the quiz's Previous/Next bar, admin's save bar and toasts all sit on it.
- `useSoftKeyboard` marks `<html data-keyboard="open">` on touch devices while a text field has focus. The tab bar slides away and the pinned bars drop to the screen edge.
- `useBackToClose` makes the Android back button (and browser back) close the account menu and confirmation dialogs first. Navigating from the menu replaces its history entry, so no stray step is left behind.
- Hover styles apply only on devices that can hover (Tailwind `hoverOnlyWhenSupported`), there's no tap-highlight flash, and controls get `touch-action: manipulation`.
- Verified in a phone-emulated browser: keyboard hides and restores the tab bar; back closes the menu and stays on the page; menu → Profile → back returns to the previous page; no sideways scrolling at 360px on Home, Races, Quiz, Leaderboard and Profile. **Still to do:** a real-device pass on iPhone (Safari) and Android (Chrome).

---

## 10. Avoid (anti-generic list)

- Generic SaaS cards, purple gradients, glassmorphism everywhere, emoji as icons.
- Fake data dressed as real (circuit stats, movement arrows, earned badges).
- Copying the references pixel-for-pixel, or keeping any ticketing vocabulary (price, seat, checkout, cart).
- More than one accent colour competing. Team colours outside driver elements.
- Centre-aligned everything, or every section built from the same card.

---

## 11. Working method

1. **Analyse:** fill §3 from screenshots and write the synthesis paragraph. Show it before coding.
2. **Tokens:** update `tailwind.config.js` and `index.css`, then restyle `components/ui.tsx` primitives (Button, Badge, SectionTitle, EmptyState, dialogs, toasts).
3. **Signature pieces:** `RaceHero`, `GrandPrixCard` (ticket card), `TrackOutline`, `Countdown`, the new `PredictionPass`.
4. **Quiz Arena** and all five inputs, then the bottom sheet and the locked state.
5. **Remaining pages:** Home, Races, Race Hub, Standings, Profile, Login, Admin.
6. **Verify:** `npm test`, `npm run build`, demo mode walkthrough at 390px and 1280px, reduced-motion check.

---

## 12. Deliverables and acceptance

- [ ] §3 filled and the synthesis approved
- [ ] Updated tokens and primitives, with no hard-coded hex in components
- [ ] Every route restyled, with loading/empty/error/populated states
- [ ] `PredictionPass` component used on quiz completion, Race Hub → Predictions, and Profile → My passes
- [ ] All five question types designed and keyboard accessible
- [ ] Mobile bottom nav plus sticky quiz CTA, with safe areas handled
- [ ] Every screen checked on iOS Safari, Android Chrome, the installed app and desktop, at the §9.1 sizes
- [ ] `IntroSplash` plays once per session, is skippable, is skipped under reduced motion, never blocks the app, hands off white → black → app with no flash, and the file is self-hosted in `public/animations/`
- [ ] Creator credit and the "Unofficial fan community" disclaimer are in place
- [ ] Demo mode works end to end
- [ ] `npm test` green, `npm run build` clean
- [ ] Short summary: what changed, any new dependency and why, and screenshots of Home, Race Hub, Quiz Arena and Prediction Pass at 390px
