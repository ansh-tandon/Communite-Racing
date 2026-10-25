-- Any race: current results, who has entered, every pick against the results, and live totals.
-- Run against the live database (race 4 = US GP):
--   psql "<External Database URL from Render>?sslmode=require" -v race=4 -f backend/scripts/race_live.sql
\pset pager off
\set ON_ERROR_STOP on

\echo '== The race'
SELECT id, name, status,
       to_char(quiz_opens_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS opens_ist,
       to_char(quiz_closes_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS locks_ist,
       openf1_session_key AS session,
       (SELECT count(*) FROM submissions WHERE race_id = :race) AS entries
FROM races WHERE id = :race;

\echo '== Results as they stand (openf1_live = provisional, openf1 = final, manual = typed in, blank = missing)'
SELECT q.sequence AS q, left(q.prompt, 50) AS question, k.correct_value AS result, k.source,
       to_char(k.entered_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS updated_ist
FROM questions q LEFT JOIN answer_keys k ON k.question_id = q.id
WHERE q.race_id = :race ORDER BY q.sequence;

\echo '== Who has entered (answered = questions picked so far)'
SELECT u.display_name AS player, u.email, count(a.id) AS answered,
       to_char(max(a.updated_at) AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI:SS') AS last_change_ist
FROM submissions s JOIN users u ON u.id = s.user_id
LEFT JOIN answers a ON a.submission_id = s.id
WHERE s.race_id = :race GROUP BY u.display_name, u.email ORDER BY answered DESC, player;

-- Points per pick, as the site scores them: right = weight, wrong = -penalty, blank or no result yet = 0.
-- Pick several: a share per correct pick (Q9 picks 1, so any of the drivers in the result counts).
CREATE TEMP VIEW graded AS
SELECT u.display_name AS player, q.sequence AS q, a.value AS picked, k.correct_value AS result,
       to_char(a.updated_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS picked_at_ist,
       CASE
         WHEN a.value IS NULL OR k.correct_value IS NULL THEN 0
         WHEN q.type = 'number' THEN
           CASE WHEN abs((a.value #>> '{}')::numeric - (k.correct_value #>> '{}')::numeric)
                     <= coalesce((q.config->>'tolerance')::numeric, 0) THEN q.weight
                ELSE -coalesce((q.config->>'penalty')::int, 0) END
         WHEN q.type = 'multi' THEN
           coalesce(nullif(q.weight * (SELECT count(*) FROM jsonb_array_elements(a.value) p
                                       WHERE k.correct_value @> jsonb_build_array(p.value))
                           / least(coalesce((q.config->>'pick')::int, jsonb_array_length(k.correct_value)),
                                   jsonb_array_length(k.correct_value)), 0),
                    -coalesce((q.config->>'penalty')::int, 0))
         WHEN a.value = k.correct_value THEN q.weight
         ELSE -coalesce((q.config->>'penalty')::int, 0)
       END AS points
FROM submissions s
JOIN users u ON u.id = s.user_id
JOIN questions q ON q.race_id = s.race_id
LEFT JOIN answers a     ON a.submission_id = s.id AND a.question_id = q.id
LEFT JOIN answer_keys k ON k.question_id = q.id
WHERE s.race_id = :race;

\echo '== Every pick against the current result'
SELECT player, q, picked, result, points, picked_at_ist FROM graded ORDER BY player, q;

\echo '== Live totals (should match the Leaderboard page)'
SELECT rank() OVER (ORDER BY sum(points) DESC) AS rank, player, sum(points) AS points
FROM graded GROUP BY player ORDER BY points DESC, player;
