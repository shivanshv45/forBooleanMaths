import { dayRange } from '../utils/dates.js';

// one pipeline, all the maths runs in mongo - nothing is summed or divided in node
export function buildReportPipeline(reportDate) {
  const { start, end } = dayRange(reportDate);

  return [
    {
      $match: {
        slack_notifications_enabled: true,
        slack_webhook_url: { $nin: [null, ''] },
      },
    },
    {
      // sub-pipeline form so the date filter happens during the join,
      // not after pulling every stat row the client ever had
      $lookup: {
        from: 'daily_stats',
        let: { clientId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$client_id', '$$clientId'] },
                  { $gte: ['$date', start] },
                  { $lt: ['$date', end] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              spend_cents: { $sum: '$spend_cents' },
              revenue_cents: { $sum: '$revenue_cents' },
            },
          },
        ],
        as: 'totals',
      },
    },
    // drop clients with no data for the day rather than sending an all-zero report
    { $match: { 'totals.0': { $exists: true } } },
    {
      $addFields: {
        spend_cents: { $first: '$totals.spend_cents' },
        revenue_cents: { $first: '$totals.revenue_cents' },
      },
    },
    {
      $addFields: {
        // guard the divide, a client can spend nothing and still bring revenue
        roas: {
          $cond: [
            { $gt: ['$spend_cents', 0] },
            { $divide: ['$revenue_cents', '$spend_cents'] },
            null,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        client_id: '$_id',
        client_name: '$name',
        webhook_url: '$slack_webhook_url',
        spend_cents: 1,
        revenue_cents: 1,
        roas: 1,
      },
    },
    { $sort: { client_id: 1 } },
  ];
}
