# Backend gaps

What the frontend brief asks for that the FastAPI backend doesn't serve yet. The UI never fakes these.
It shows an honest "not available yet" state instead, and each item lists the contract it would need.

| Feature | What the UI does now | Contract needed |
|---|---|---|
| Driver list and team colours | Uses `src/fixtures/drivers.ts`, a clearly marked development fixture. Unknown codes show as plain text. | `GET /drivers?season=` → `[{ code, name, team, team_color, number }]` |
| Race weekend schedule (FP1, qualifying, race times) | Shows only the quiz window, with a note that session times aren't available. | Add `sessions: [{ name, starts_at }]` to `GET /races/{id}` |
| Circuit details and images | Shows circuit name and country; uses a decorative, abstract track line. | Add `circuit_length_km`, `laps`, `image_url` to races |
| Circuit location (globe pin) | `src/fixtures/circuits.ts` matches the race's circuit/name to known coordinates. A race it can't match shows the globe without a pin. | Add `lat`, `lng` (and `city`) to races |
| Next race on the login page | The login globe pins the next race using the 2026 calendar and race days hard-coded in `src/fixtures/circuits.ts`, because `GET /races` needs a login. Must be updated each season. | Public (no-auth) `GET /calendar?season=` → `[{ round, name, circuit, country, race_day }]` |
| Badges and achievements | Profile lists the planned badges as "not switched on yet". Nothing is shown as earned. | `GET /users/me/badges` (tables `badges` / `user_badges` already exist; awarding was deferred) |
| Community feed and friend challenges | Community page shows the real community info and an empty "coming later" state. | `GET /community/events`, challenges design TBD |
| Standings movement (up/down arrows) | Not shown. | Per-round standings snapshot, e.g. `GET /standings?season=&after_round=` |
| Search and pagination on standings | Done in the browser. Fine for ~100 players. | Optional: `?q=&page=` on `/standings` |
| Editing questions after creating a race | Links to the SQLAdmin data panel at `<API>/admin`. | `PATCH /admin/races/{id}`, `PUT /admin/races/{id}/questions` |
| Re-score reason shown to players | Not collected. | `reason` field on `POST /admin/races/{id}/rescore`, returned on the race |
| Resend-code cooldown policy | Fixed 30 s in the UI; the server's 5-per-hour limit returns 429, which the UI explains. | Optional: `retry_after` in the 429 response |
| Automatic answer-key drafts (OpenF1) | **Backend done** (`app/services/openf1`): live (`openf1_live`) and final (`openf1`) results per question rule. The admin screens don't yet show a question's rule or each result's source. | Already served: `auto` on admin questions, `answer_key_sources` and `openf1_session_key` on `GET /admin/races/{id}` |

Not applicable to this league, so deliberately not built: quiz timers per question, difficulty and category labels, and instant correct/incorrect feedback. Every question here is a race prediction whose answer only exists after the race.
