-- Read article details every 2 minutes (5 pages per run) so a fresh index fills in about 4 hours.
-- When nothing is pending each run is a single quick query.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'official-pages-details'),
  schedule := '*/2 * * * *'
);
