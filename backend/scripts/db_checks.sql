-- Handy read-only checks on the live database. Run one block at a time in psql, or the whole file:
--   psql "<External Database URL>?sslmode=require" -v race=4 -f backend/scripts/db_checks.sql
-- Nothing here changes data. :race is the race id (4 = US GP).
\pset pager off

\echo '== Every race: status and times (IST)'
SELECT id, season, round, left(name, 28) AS name, status,
       to_char(quiz_opens_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS opens,
       to_char(quiz_closes_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS locks,
       openf1_session_key AS session,
       (SELECT count(*) FROM questions q WHERE q.race_id = r.id) AS questions,
       (SELECT count(*) FROM submissions s WHERE s.race_id = r.id) AS entries
FROM races r ORDER BY season, round;

\echo '== Players: how many, and the newest sign-ups'
SELECT count(*) FILTER (WHERE NOT is_admin) AS players, count(*) FILTER (WHERE is_admin) AS admins FROM users;
SELECT id, display_name, email, is_admin, to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS joined_ist
FROM users ORDER BY created_at DESC LIMIT 15;

\echo '== Entries per 10 minutes (when people are playing)'
SELECT to_char(date_bin('10 minutes', created_at, timestamp '2000-01-01') AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS from_ist,
       count(*) AS new_entries
FROM submissions WHERE race_id = :race GROUP BY 1 ORDER BY 1;

\echo '== Players who entered but left questions blank'
SELECT u.display_name, u.email, count(a.id) AS answered,
       (SELECT count(*) FROM questions WHERE race_id = :race) - count(a.id) AS blank
FROM submissions s JOIN users u ON u.id = s.user_id LEFT JOIN answers a ON a.submission_id = s.id
WHERE s.race_id = :race GROUP BY u.display_name, u.email
HAVING count(a.id) < (SELECT count(*) FROM questions WHERE race_id = :race) ORDER BY answered;

\echo '== What the crowd picked, per question (top 3 picks)'
SELECT q, pick, players FROM (
  SELECT q.sequence AS q, a.value AS pick, count(*) AS players,
         row_number() OVER (PARTITION BY q.sequence ORDER BY count(*) DESC) AS n
  FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.race_id = :race
  GROUP BY q.sequence, a.value) t
WHERE n <= 3 ORDER BY q, players DESC;

\echo '== Any pick changed after the lock? (should be none: the lock is enforced)'
SELECT u.display_name, q.sequence AS q, a.value,
       to_char(a.updated_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI:SS') AS changed_ist
FROM answers a JOIN questions q ON q.id = a.question_id JOIN races r ON r.id = q.race_id
JOIN submissions s ON s.id = a.submission_id JOIN users u ON u.id = s.user_id
WHERE r.id = :race AND a.updated_at > r.quiz_closes_at;

\echo '== Questions: marking and auto-answer rule'
SELECT sequence AS q, type, weight AS pts, coalesce((config->>'penalty')::int, 0) AS minus,
       config, auto, jsonb_array_length(options) AS options
FROM questions WHERE race_id = :race ORDER BY sequence;

\echo '== Stored scores (after Save and score)'
SELECT s.rank, u.display_name, s.points, s.correct_count,
       to_char(s.computed_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS scored_ist
FROM scores s JOIN users u ON u.id = s.user_id WHERE s.race_id = :race ORDER BY s.rank, u.display_name;

\echo '== Season standings (published races only)'
SELECT rank() OVER (ORDER BY sum(s.points) DESC) AS rank, u.display_name, sum(s.points) AS points, count(*) AS races
FROM scores s JOIN users u ON u.id = s.user_id JOIN races r ON r.id = s.race_id
WHERE r.published_at IS NOT NULL GROUP BY u.display_name ORDER BY points DESC;

\echo '== Login codes sent in the last hour (are emails going out?)'
SELECT email, to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS sent_ist, attempts, consumed_at IS NOT NULL AS used
FROM otp_codes WHERE created_at > now() - interval '1 hour' ORDER BY created_at DESC;

\echo '== Database size and connections (free plan: 1 GB, 100 connections)'
SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
       (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections;
