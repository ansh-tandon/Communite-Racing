-- FP1 quiz (race 10): current results, every player's picks against them, and live totals.
-- Run against the live database:  psql "<External Database URL from Render>" -f backend/scripts/fp1_live.sql
\pset pager off

\echo '== Results as they stand (source: openf1_live = provisional, openf1 = final, manual = typed in)'
SELECT q.sequence AS q, left(q.prompt, 45) AS question, k.correct_value AS result, k.source,
       to_char(k.entered_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS updated_ist
FROM questions q LEFT JOIN answer_keys k ON k.question_id = q.id
WHERE q.race_id = 10 ORDER BY q.sequence;

\echo '== Every pick against the current result (+5 right, -1 wrong, 0 blank or no result yet)'
WITH graded AS (
  SELECT u.display_name AS player, q.sequence AS q, q.type, a.value AS picked, k.correct_value AS result,
         to_char(a.updated_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS picked_at_ist,
         CASE
           WHEN a.value IS NULL OR k.correct_value IS NULL THEN 0
           WHEN q.type = 'number'
             AND abs((a.value #>> '{}')::int - (k.correct_value #>> '{}')::int)
                 <= coalesce((q.config->>'tolerance')::int, 0) THEN q.weight
           WHEN q.type <> 'number' AND a.value = k.correct_value THEN q.weight
           ELSE -coalesce((q.config->>'penalty')::int, 0)
         END AS points
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  JOIN questions q ON q.race_id = s.race_id
  LEFT JOIN answers a     ON a.submission_id = s.id AND a.question_id = q.id
  LEFT JOIN answer_keys k ON k.question_id = q.id
  WHERE s.race_id = 10
)
SELECT player, q, picked, result, points, picked_at_ist FROM graded ORDER BY player, q;

\echo '== Live totals (should match the Leaderboard tab)'
WITH graded AS (
  SELECT u.display_name AS player,
         CASE
           WHEN a.value IS NULL OR k.correct_value IS NULL THEN 0
           WHEN q.type = 'number'
             AND abs((a.value #>> '{}')::int - (k.correct_value #>> '{}')::int)
                 <= coalesce((q.config->>'tolerance')::int, 0) THEN q.weight
           WHEN q.type <> 'number' AND a.value = k.correct_value THEN q.weight
           ELSE -coalesce((q.config->>'penalty')::int, 0)
         END AS points
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  JOIN questions q ON q.race_id = s.race_id
  LEFT JOIN answers a     ON a.submission_id = s.id AND a.question_id = q.id
  LEFT JOIN answer_keys k ON k.question_id = q.id
  WHERE s.race_id = 10
)
SELECT player, sum(points) AS live_points FROM graded GROUP BY player ORDER BY live_points DESC, player;
