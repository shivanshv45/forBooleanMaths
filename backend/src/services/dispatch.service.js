import logger from '../utils/logger.js';
import { formatDate, yesterday } from '../utils/dates.js';
import NotificationLog, { LOG_STATUS } from '../models/NotificationLog.js';
import { getReportsForDate } from './report.service.js';
import { claimReport, pushJob } from './queue.js';

// runs the aggregation and queues one job per client, returns immediately.
// sending happens in the worker, nothing here waits on slack
export async function enqueueReports({ reportDate = yesterday(), force = false } = {}) {
  const dateKey = formatDate(reportDate);
  const reports = await getReportsForDate(reportDate);

  let queued = 0;
  let skipped = 0;

  for (const report of reports) {
    if (!force) {
      const claimed = await claimReport(report.client_id, dateKey);
      if (!claimed) {
        skipped += 1;
        continue;
      }
    }

    // log row exists before the job does, so the dashboard shows pending straight away
    const log = await NotificationLog.create({
      client_id: report.client_id,
      client_name: report.client_name,
      report_date: reportDate,
      status: LOG_STATUS.PENDING,
      spend_cents: report.spend_cents,
      revenue_cents: report.revenue_cents,
      roas: report.roas,
    });

    await pushJob({
      log_id: log._id.toString(),
      client_id: report.client_id,
      client_name: report.client_name,
      webhook_url: report.webhook_url,
      report_date: reportDate.toISOString(),
      spend_cents: report.spend_cents,
      revenue_cents: report.revenue_cents,
      roas: report.roas,
      attempts: 0,
    });

    queued += 1;
  }

  logger.info('dispatch', `${dateKey} - queued ${queued}, skipped ${skipped} of ${reports.length} eligible`);

  return { reportDate: dateKey, eligible: reports.length, queued, skipped };
}
