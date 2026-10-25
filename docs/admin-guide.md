# Running Communitie Racing: the admin guide

Everything an admin does, from creating a quiz to publishing results, and every way to do it: the website,
the data panel, the API (browser console), the database, and asking Claude Code to do it for you.

| Thing | Address |
|---|---|
| Players' site | https://communitieracing.in |
| Admin pages (on the site) | https://communitieracing.in/admin |
| Data panel (edit any race, question, player) | https://api.communitieracing.in/admin |
| API | https://api.communitieracing.in |
| Hosting | Render: `crql` (website), `crql-api` (API), `crql-db` (Postgres) |

---

## 1. Who can be an admin, and logging in

- Admins are the emails listed in `ADMIN_EMAILS` on Render (`crql-api` → Environment), comma-separated.
  An address becomes admin the next time it logs in.
- **Website:** log in as usual (email code or Google). Admins see an **Admin** link.
- **Data panel:** open https://api.communitieracing.in/admin, enter your email, press **Send code**, type the code.

## 2. A quiz's life

```
Draft ──Open──► Open ──deadline──► Locked ──Score──► Scored ──► Published
 (hidden)      (players answer)    (live standings)   (points stored)  (everyone sees results)
```

| Stage | What players see | What you can change |
|---|---|---|
| **Draft** | Nothing | Everything |
| **Open** | The quiz; answers save as they tap | Wording and points. **Not** type, options or config |
| **Locked** (at `quiz_closes_at`) | "Locked", live provisional standings | Results (answer key) |
| **Scored** | Results, if "reveal immediately" is on | Re-score after a penalty |
| **Published** | Results, race leaderboard, season standings | Re-score |

- The lock is checked by the database clock on every save, so it can't be beaten. A background job also marks
  the quiz **closed** within 30 s of the deadline.
- Moving the deadline only works **while the quiz is still open**: once it's closed, a later deadline won't reopen it.
- **Reveal immediately** (on by default): scoring publishes at once. Turn it off to check results before publishing.
- Only one quiz per **season + round** number. A practice or qualifying quiz needs its own round number (we used 40).

---

## 3. Creating a quiz: five ways

### A. On the website (easiest, no auto-answers)

1. https://communitieracing.in/admin → **New race**.
2. Fill in **Grand Prix**, **Circuit**, **Country**, **Season**, **Round**, **Quiz opens (your time)**,
   **Quiz locks (normally lights out)**, and the box **Show results to players as soon as scoring finishes**.
3. The seven standard questions are pre-filled. Edit, remove (bin icon) or **Add** questions. Each has wording,
   **Type**, **Points**, and depending on the type **Pick**, **Min / Max**, and **Options** (comma-separated;
   driver codes like `VER` show as names and team colours).
4. **Create draft**, then on the race page **Open quiz**.

The website form can't set **auto-answer rules** or **negative marking**. Add those in the data panel (B) before
opening, or create the quiz with C or E instead.

Shortcut: create the race with no questions, then **Copy previous questions** on its page.

### B. In the data panel (every field)

1. **Races → + New**: season, round, name, circuit, country, opens / closes (typed in **IST**),
   reveal immediately, OpenF1 session (leave empty: found automatically).
2. **Questions → + New**, one per question:

| Field | What to put |
|---|---|
| Race | pick the race |
| Question number | 1, 2, 3… |
| Prompt | the wording players see |
| Type | `single` (Pick one), `multi` (Pick several), `ranked` (Put in order), `number`, `yes_no` |
| Points | e.g. `5` |
| Options | JSON list: `["VER","NOR","LEC"]`; `[]` for number and yes / no |
| Config | JSON, see section 4 |
| Auto-answer from OpenF1 | JSON rule, see section 5; leave empty to answer by hand |

3. Or select a race and use the action **Copy questions from previous race**.
4. Select the race → Actions → **Open quiz to players**.

Other race actions: **Close quiz now** (locks early), **Fill results from OpenF1 now**.

### C. With the API, from the browser console (any quiz in one go)

On communitieracing.in, logged in as admin: **Ctrl + Shift + J** → type `allow pasting` the first time → paste → Enter.

```js
(async () => {
  const H = { Authorization: 'Bearer ' + localStorage.getItem('crql.token'), 'Content-Type': 'application/json' };
  const post = (p, b) => fetch('https://api.communitieracing.in' + p, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then(async r => ({ status: r.status, data: await r.json() }));
  const FRONT = ['NOR','PIA','VER','LEC','RUS','HAM','ANT','ALO','HAD','SAI'];
  const r = await post('/admin/races', {
    season: 2026, round: 19, name: 'Mexico City Grand Prix', circuit: 'Autódromo Hermanos Rodríguez', country: 'Mexico',
    quiz_opens_at: '2026-10-25T20:00:00Z', quiz_closes_at: '2026-11-01T20:00:00Z',   // UTC; IST = UTC + 5:30
    reveal_immediately: true,
    questions: [
      { prompt: 'Who wins?', type: 'single', weight: 10, options: FRONT, config: {}, auto: { rule: 'winner' } },
      { prompt: 'Predict the podium', type: 'ranked', weight: 15, options: FRONT, config: { pick: 3 }, auto: { rule: 'top', n: 3 } },
    ],
  });
  console.log(r.status, r.data.detail ?? `created race ${r.data.id}`);
  if (r.status === 201) console.log('open:', (await post(`/admin/races/${r.data.id}/open`)).status);
})();
```

`409` means that season + round already exists. `422` means a question doesn't fit its type; the message says which.

### D. The seed script (the rest of the calendar)

```bash
cd backend
python -m app.seed      # adds the rounds still to come, 7 standard questions each, quizzes open a week before
```

It skips rounds that already exist, so it's safe to run twice. **Never** run `--sample-players` against the live
database: it adds 30 fake players with answers and scores. To remove them: `python -m app.seed --remove-sample-players`.
To run it against the live database, set `DATABASE_URL` to the External Database URL from Render first.

### E. Ask Claude Code ("directly from here")

Describe the quiz in plain words: the session, the questions, the marking and the lock time. Claude Code:

1. writes the questions into `backend/app/question_sets.py`, using only rules that can answer them;
2. replays them on recorded real sessions with the test suite, to prove each one gets a result;
3. creates and opens the quiz on the live site. It asks your site for a login code, you paste the 6-digit code
   from your email into the chat, and it uses that login for this one job only;
4. links the OpenF1 session, watches the session, and tells you any answers you need to type by hand.

This is how the FP1 quiz (race 10) was made. Allow 10–15 minutes before the lock time.

---

## 4. Question types and config

| Type | Answer looks like | Options | Config |
|---|---|---|---|
| `single` (Pick one) | `"LEC"` | 2+ unique texts | `{}` |
| `multi` (Pick several) | `["LEC","HAM"]` | 2+ | `{"pick": 3}` |
| `ranked` (Put in order) | `["VER","NOR","LEC"]` | 2+ | `{"pick": 3}` |
| `number` | `44` | `[]` | `{"min": 15, "max": 65, "tolerance": 2}` |
| `yes_no` | `true` / `false` | `[]` | `{}` |

Config keys, any combination:

| Key | Types | Effect |
|---|---|---|
| `pick` | multi, ranked | How many to choose (required) |
| `scoring: "all"` | multi, ranked | All-or-nothing; default `"per_item"` gives a share per correct pick |
| `min`, `max` | number | Allowed range |
| `tolerance` | number | Counts as right within ± this |
| `penalty` | any | Points taken off a wrong answer (e.g. `1` for −1). Blank answers score 0; partial credit is never penalised |

Scoring: right = the question's points; wrong = 0, or −penalty; blank = 0. Equal totals share a rank (1, 2, 2, 4).
**+5 / −1 marking** = Points `5` and config `{"penalty": 1}` on every question.

Driver codes for options: NOR PIA VER HAD LEC HAM RUS ANT ALO STR SAI ALB GAS COL OCO BEA HUL BOR LAW LIN PER BOT.
Teams: McLaren, Mercedes, Red Bull, Ferrari, Williams, Racing Bulls, Aston Martin, Haas, Audi, Alpine, Cadillac.
Check OpenF1's entry list on the day: reserve drivers sometimes take a car in practice (Colton Herta, `HER`, drove
Pérez's Cadillac in Austin FP1).

---

## 5. Automatic results from OpenF1

Give a question an `auto` rule and the server fills its result. It matches drivers to options by code, surname or
number, and teams loosely ("Red Bull" matches "Red Bull Racing").

| Rule | What it answers | Types | Settings | When |
|---|---|---|---|---|
| `winner` | Winner (or P1 of a practice session) | single | — | live + final |
| `position` | Driver in position N | single | `position` | live + final |
| `pole` | Pole position | single | — | live + final |
| `leader_after_lap` | Leader after lap N | single | `lap` | live + final |
| `fastest_lap` | Fastest lap | single | — | live + final |
| `most_places_gained` | Most places gained, grid to finish | single | — | after classification |
| `first_retirement` | First driver to retire | single | — | after classification |
| `fastest_pit_lane` | Fastest pit lane time | single | — | live + final |
| `most_laps` | Most laps (practice) | single | — | after classification |
| `winning_team` | Winning (or fastest) team | single | — | live + final |
| `top` | Top N (Pick several) / order (Put in order) | multi, ranked | `n` | live + final |
| `top_after_lap` | Top N after lap L | multi, ranked | `lap`, `n` | live + final |
| `qualifying_top` | Top N in qualifying | multi, ranked | `n` | live + final |
| `retired_drivers` | Drivers who didn't finish | multi, ranked | — | after classification |
| `safety_cars` | Safety car deployments | number | — | live + final |
| `virtual_safety_cars` | VSC deployments | number | — | live + final |
| `neutralisations` | SC + VSC | number | — | live + final |
| `red_flags` | Red flags | number | — | live + final |
| `pit_stops` | Pit stops, all cars | number | — | live + final |
| `pit_stops_under_sc` | Pit stops under SC | number | `include_vsc` (true) | live + final |
| `retirements` | Drivers who didn't finish | number | `include_dns` (true) | after classification |
| `classified_finishers` | Classified finishers | number | — | after classification |
| `overtakes` | Overtakes (OpenF1 data may be incomplete) | number | — | live + final |
| `lead_changes` | Lead changes | number | — | live + final |
| `finishing_position` | A driver's position | number | `driver` | live + final |
| `total_laps` | Laps by all cars (practice) | number | — | after classification |
| `winning_margin` | Winning margin, seconds | number | — | after classification |
| `max_track_temp` | Hottest track temperature, °C | number | — | live + final |
| `safety_car` | Was there a safety car? | yes_no | `include_vsc` (false) | live + final |
| `virtual_safety_car` | Was there a VSC? | yes_no | — | live + final |
| `red_flag` | Was there a red flag? | yes_no | — | live + final |
| `rain` | Did it rain? | yes_no | — | live + final |
| `pole_converts` | Does the pole sitter win? | yes_no | — | live + final |
| `driver_wins` | Does a driver win? | yes_no | `driver` | live + final |
| `driver_in_top` | Does a driver finish in the top N? | yes_no | `driver`, `n` | live + final |
| `driver_retires` | Does a driver retire? | yes_no | `driver` | after classification |
| `team_wins` | Does a team win? | yes_no | `team` | live + final |
| `team_both_in_top` | Both of a team's drivers in the top N? | yes_no | `team`, `n` (3) | live + final |
| `everyone_finishes` | Does every driver finish? | yes_no | — | after classification |

Examples: `{"rule": "winner"}`, `{"rule": "top", "n": 3}`, `{"rule": "driver_in_top", "driver": "HAM", "n": 10}`,
`{"rule": "safety_car", "include_vsc": true}`. Not available (answer by hand): Driver of the Day, stewards' decisions.

**Timing**

| When | Without an OpenF1 account | With one (`OPENF1_USERNAME` / `OPENF1_PASSWORD` on Render) |
|---|---|---|
| Before the lock | nothing | nothing |
| From the lock to the end of the session | nothing (OpenF1 locks live sessions) | every 20 s, saved as **live** (`openf1_live`) |
| After the session | every 2 min until the official classification, then **final** (`openf1`) | same |
| Next 6 hours | re-checked every 10 min for penalties | same |

- A result you type yourself (`manual`) is never overwritten.
- A race can't be scored while any result is still **live**.
- Ties (e.g. four drivers on the most laps) are never guessed: the question shows **no value** and you enter it.
- **Session link:** found automatically: the OpenF1 session (race, qualifying, practice) starting closest to the
  quiz's lock. Check it on the race page or with the snippet in section 7; to change it:
  `POST /admin/races/{id}/openf1/link` with `{"session_key": 11389}`, or the OpenF1 session field in the data panel.

---

## 6. During and after the session

1. **Lock.** Players can't change answers. The quiz's **Leaderboard** tab shows **Live · provisional** standings,
   re-read every 20 s: points against the results known so far, plus a **Season** view with those points added to
   the published standings (▲ / ▼ = places moved). Nothing is stored.
2. **Live results** fill in by themselves (with an OpenF1 account). To force a read now: data panel → race →
   **Fill results from OpenF1 now**.
3. **After the classification**, the results switch from live to final by themselves.
4. **Answers by hand:** https://communitieracing.in/admin/races/{id} → **Race results**: pick or type each missing
   result. **Save draft** keeps them without scoring.
5. **Save and score** stores everyone's points and, with reveal immediately on, publishes. Otherwise press
   **Publish results** after checking.
6. **Penalty after publishing?** Correct the result and re-score (`POST /admin/races/{id}/rescore`). Points and ranks
   are replaced, not added.

---

## 7. Watching it work

**Results and their source** (admin page or console):

```js
fetch('https://api.communitieracing.in/admin/races/10/openf1', { headers: { Authorization: 'Bearer ' + localStorage.getItem('crql.token') } })
  .then(r => r.json()).then(d => { console.log('session', d.session_key, 'checked', d.last_check?.checked_at); console.table(d.last_check?.questions); });
```

**Raw OpenF1 data** through your server: `GET /admin/openf1/data/{endpoint}?session_key=…` for `position`,
`session_result`, `laps`, `race_control`, `weather`, `drivers`, `pit` and the rest.

**The database** (read what players picked and how it's being scored):

```powershell
$env:DB = "<External Database URL from Render crql-db → Connect>?sslmode=require"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $env:DB -f backend\scripts\fp1_live.sql
```

`backend/scripts/fp1_live.sql` shows the results as they stand, every pick against them with points, and live
totals. Change `race_id = 10` to another race's id.

| Table | Holds |
|---|---|
| `races` | One row per quiz: times, `status`, `openf1_session_key`, `published_at` |
| `questions` | Prompt, type, points (`weight`), `options`, `config`, `auto` |
| `submissions` / `answers` | Who entered; each pick (`value`) with `updated_at` |
| `answer_keys` | Each result: `correct_value`, `source` (`openf1_live` / `openf1` / `manual`), `entered_at` |
| `scores` | Points and rank per player, written by Score |

**Render logs** (`crql-api` → Logs): `Closed quizzes at deadline`, `OpenF1 live results for race N`,
`OpenF1 final results for race N`, `OpenF1 sync for race N: …` (a problem, with the reason).

---

## 8. Race weekend checklist

| When | Do |
|---|---|
| A week before | The quiz is open (seed script opens it a week before lights out). Check its questions and lock time |
| Before the lock | Check the OpenF1 session link is the right session. Optional: ping `/health` every 10 min (e.g. UptimeRobot) so the free API never sleeps |
| Lock (lights out) | Open the Leaderboard tab: **Live · provisional**, results climbing |
| ~10–30 min after the flag | Results turn final. Type any missing ones. **Save and score** |
| Next 6 hours | If a penalty changes the result, correct it and re-score |

---

## 9. When something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| All results **Missing** after the lock | Quiz linked to the wrong session, or no OpenF1 account on Render | Link the right session (section 5); add `OPENF1_USERNAME` / `OPENF1_PASSWORD` to `crql-api` |
| Sync says **503 OpenF1 refused** | No account, or OpenF1 rejected it | Check the two variables match `backend/.env` exactly |
| **"0 of N results in"**, everyone on 0 | No results yet | Normal before the first live read |
| A question stays **no value** | Tie, a driver not in the session, or the answer only exists after the classification | Enter it by hand when known |
| Site slow for the first minute | Free API woke from sleep | Wait, or keep it awake with a ping |
| **"Answers are locked"** for a player | The deadline passed | Expected. Only an admin can change the deadline, and only before it passes |
| Fake names on leaderboards | Sample players in the live database | `python -m app.seed --remove-sample-players` against the live database |

---

## 10. Hosting notes (Render)

- `crql-api` env: `DATABASE_URL` (linked), `JWT_SECRET`, `ADMIN_EMAILS`, `RESEND_API_KEY` (login emails),
  `GOOGLE_CLIENT_ID`, `FRONTEND_ORIGIN`, `OPENF1_USERNAME`, `OPENF1_PASSWORD`, `SENTRY_DSN`. Saving env vars restarts
  the API for about 2–3 minutes: avoid that while a quiz is open.
- Pushing to `main` on GitHub redeploys both the API and the site.
- **Free plan limits:** the API sleeps after 15 idle minutes (first visit takes ~1 minute). The free database holds
  1 GB (8.7 MB used in October 2026) with 100 connections, and **expires 30 days after it was created** (around
  18 November 2026 for this one). Move it to a paid plan before then, or the season's data is deleted after the
  grace period.
- If the database address is ever shared, rotate its password in Render.
