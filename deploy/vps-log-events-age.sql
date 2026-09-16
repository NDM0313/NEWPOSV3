\c _supabase
SELECT min(timestamp) AS oldest, max(timestamp) AS newest, count(*) AS rows
FROM _analytics.log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe;

SELECT date_trunc('day', timestamp) AS day, count(*) AS rows
FROM _analytics.log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe
GROUP BY 1 ORDER BY 1 DESC LIMIT 10;
