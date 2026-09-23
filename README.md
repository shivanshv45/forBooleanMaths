# Slack Report Dispatcher

Sends the daily attribution report (spend, revenue, ROAS) to client Slack channels every morning at 9am.

Slack webhooks allow about one message per second, so the reports are not fired off in parallel. They go into a Redis queue and a separate worker drains it one message per second, pausing and retrying when Slack returns a 429 rather than dropping the report.

## How it works

```
cron 9am (or the manual trigger)
      |
mongo aggregation  ->  one row per opted-in client: spend, revenue, roas
      |
push to redis queue  ->  request returns here, nothing waits on slack
      |
worker process       ->  moves one job per second to a processing list
      |
POST block kit  ->  slack
      |
  200  ->  log marked sent
  429  ->  read Retry-After, pause the queue, put the job back, retry
```

The API and the worker are **two separate processes**. They share Mongo, Redis and config but run independently. Doing the sending inside a request handler would tie delivery to the lifetime of an HTTP request and block the event loop.

## Stack

Node + Express, MongoDB (mongoose), Redis (ioredis), React (Vite).

## Setup

Needs Node 18+ and Docker.

```bash
docker compose up -d

cd backend
cp .env.example .env
npm install
npm run seed
```

Then run the two backend processes in separate terminals:

```bash
npm run dev      # api on :4000
npm run worker   # queue worker + 9am cron
```

And the frontend:

```bash
cd frontend
npm install
npm run dev      # dashboard on :5173
```

Check the API came up:

```bash
curl http://localhost:4000/api/health
# {"success":true,"data":{"status":"ok","mongo":"up","redis":"up","uptimeSeconds":3}}
```

Returns 503 with `"status":"degraded"` if either connection is down, naming which one.

### Without Docker

Point `MONGO_URI` and `REDIS_URL` at your own instances. Nothing else changes.

## Demoing the 429 retry

The seed points every client at the local mock webhook by default, so this works with no Slack account.

The mock rejects 20% of calls by default, per the brief.

1. Raise `MOCK_FAILURE_RATE` to `0.4` in `backend/.env` and restart the API, so the retry path fires without waiting on the dice. Much higher and you mostly just sit through pauses.
2. Open the dashboard and press **Send test report**.
3. Watch the worker terminal:

```
[worker]  started, 1000ms between sends
[worker] WARN 429 for client_1, pausing 2000ms and requeueing
[worker]  sent to client_1 (Brand A)
[worker]  sent to client_2 (Brand B)
[worker] WARN 429 for client_3, pausing 2000ms and requeueing
[worker]  sent to client_3 (Brand C)
```

Every client still ends up `sent`. Nothing is dropped. The logs table on the dashboard moves from pending to sent while it drains.

`POST /api/mock-slack-webhook?fail=1` always returns a 429, for checking the response shape by hand:

```bash
curl -i -X POST -H 'Content-Type: application/json' -d '{}' \
  'http://localhost:4000/api/mock-slack-webhook?fail=1'
# HTTP/1.1 429 Too Many Requests
# Retry-After: 3
```

Don't point a client's stored webhook at it. It never succeeds, and since a 429 requeues without counting an attempt, that job would retry forever and hold up everything behind it.

### Using real Slack webhooks

Create an app at api.slack.com/apps, enable Incoming Webhooks, add one per channel, then put them in `backend/.env` as `SLACK_WEBHOOK_1` through `SLACK_WEBHOOK_5` and re-run the seed. Clients without a configured webhook fall back to the mock.

## The Slack message

Built with Block Kit, rendered as:

```
📊 Daily Attribution Report - BooleanMaths
Brand A  |  Date: 2026-09-18
-------------------------------------------
💰 Total Ad Spend:   $800.00
🛒 Total Revenue:    $2,400.00
📈 ROAS:             3.00x
-------------------------------------------
Generated automatically by BooleanMaths
```

Slack mrkdwn uses single asterisks for bold, not double. A top-level `text` field ships alongside the blocks as the notification fallback.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | mongo and redis status |
| GET | `/api/clients` | list clients |
| GET | `/api/clients/:id` | one client |
| PATCH | `/api/clients/:id` | update webhook and/or enabled flag |
| GET | `/api/clients/:id/logs?limit=20` | recent delivery logs |
| POST | `/api/reports/trigger` | run the aggregation and queue now |
| GET | `/api/reports/queue` | jobs waiting, plus any in flight |
| POST | `/api/mock-slack-webhook` | stand-in for Slack, 429s at the configured rate |

## Layout

```
backend/src/
  config/      env parsing, the only place that reads process.env
  loaders/     mongo and redis connections, shared by api and worker
  middleware/  error handling, async route wrapper
  models/      Client, DailyStat, NotificationLog
  routes/      http routes
  services/    aggregation pipeline, queue, dispatch, slack client and formatting
  workers/     the queue worker loop
  scripts/     seed
  app.js       builds the express app
  server.js    api entrypoint
  worker.js    worker entrypoint, owns the cron

frontend/src/
  api/         fetch wrapper and formatters
  components/  SettingsCard, LogsTable
  App.jsx
```

## Config

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 4000 | |
| `MONGO_URI` | — | required, fails at boot if missing |
| `REDIS_URL` | — | required, fails at boot if missing |
| `RATE_LIMIT_MS` | 1000 | gap between sends |
| `MAX_ATTEMPTS` | 5 | retries before a report is marked failed |
| `DEFAULT_RETRY_AFTER_MS` | 5000 | used when a 429 has no usable Retry-After |
| `CRON_SCHEDULE` | `0 9 * * *` | |
| `CRON_TIMEZONE` | Asia/Kolkata | |
| `MOCK_FAILURE_RATE` | 0.2 | share of mock calls that 429 |

Missing required vars throw on startup rather than surfacing as `undefined` deeper in.

`.env` is gitignored. Slack webhook URLs are secrets — anyone holding one can post into the workspace — so they live in the database and in your local `.env`, never in the repo.

## Decisions and known limits

**Raw Redis lists, not BullMQ.** BullMQ would give rate limiting and retries in a few lines of config, but the point of the exercise is the queue behaviour, so the loop is written out where it can be read.

**All the maths runs in the aggregation.** Nothing is summed or divided in Node. The `$lookup` uses the sub-pipeline form so the date filter happens during the join instead of pulling every stat row a client ever had.

**"Previous 24 hours" means calendar yesterday in UTC**, 00:00:00Z to 23:59:59.999Z. The spec's mock data uses midnight-UTC timestamps, which reads as day-bucketed.

**Zero spend gives a null ROAS**, shown as `n/a`, not `0.00x` or `Infinity`. A client can spend nothing and still bring in revenue.

**Clients with no stats for the day are skipped** rather than sent an all-zero report, which would look like a bug to the recipient.

**Money is integer cents everywhere**, converted to dollars only when formatting. Avoids float drift in numbers people budget against.

**A 429 does not count as a failed attempt.** It is a rate limit, not a bad job, so counting it toward the retry ceiling would eventually discard a perfectly good report.

**The pause on 429 stops the whole loop.** The rate limit belongs to the app, not to one client, so there is nothing useful to send during the backoff.

**Duplicate runs are prevented with a Redis `SET NX` key** per client per day. A double-fired cron or a double-clicked trigger will not send two reports. `POST /api/reports/trigger` with `{"force":true}` bypasses it.

**Jobs survive a worker crash.** `BLMOVE` moves the job onto a processing list instead of deleting it, and it is only acked once the outcome is written to Mongo. If the worker dies mid-send the job is still there, and the next worker to start puts it back on the queue. `LREM` acks by value, so one worker acking cannot remove another's in-flight job.

The trade is at-least-once delivery: a crash after Slack accepted the message but before the ack means that report sends twice on recovery. For a daily report a duplicate is better than a silent miss, so that is the right way round here. Exactly-once would need an idempotency key on the Slack side, which incoming webhooks do not offer.

**No auth on the dashboard.** Out of scope; the client is picked from a dropdown.
