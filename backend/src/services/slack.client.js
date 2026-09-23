import axios from 'axios';
import config from '../config/index.js';
import { buildReportMessage } from './slack.format.js';

export const SEND_RESULT = {
  OK: 'ok',
  RATE_LIMITED: 'rate_limited',
  FAILED: 'failed',
};

// Retry-After is in seconds, and some servers send an HTTP date instead of a number
export function parseRetryAfter(headerValue) {
  if (!headerValue) return config.defaultRetryAfterMs;

  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;

  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());

  return config.defaultRetryAfterMs;
}

export async function sendReport(job) {
  const message = buildReportMessage({
    client_name: job.client_name,
    report_date: new Date(job.report_date),
    spend_cents: job.spend_cents,
    revenue_cents: job.revenue_cents,
    roas: job.roas,
  });

  try {
    await axios.post(job.webhook_url, message, {
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });

    return { result: SEND_RESULT.OK };
  } catch (err) {
    const status = err.response?.status;

    if (status === 429) {
      return {
        result: SEND_RESULT.RATE_LIMITED,
        waitMs: parseRetryAfter(err.response.headers['retry-after']),
      };
    }

    return {
      result: SEND_RESULT.FAILED,
      error: status ? `HTTP ${status}` : err.code || err.message,
    };
  }
}
