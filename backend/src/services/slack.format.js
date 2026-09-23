import { formatDate } from '../utils/dates.js';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(cents) {
  return currency.format(cents / 100);
}

export function formatRoas(roas) {
  // null means zero spend, showing 0.00x would read as a bad campaign rather than no spend
  return roas === null || roas === undefined ? 'n/a' : `${roas.toFixed(2)}x`;
}

export function buildReportMessage({ client_name, report_date, spend_cents, revenue_cents, roas }) {
  const date = formatDate(report_date);

  return {
    // fallback for notifications and clients that cannot render blocks
    text: `Daily Attribution Report for ${client_name} - ${date}`,
    blocks: [
      {
        type: 'header',
        // header blocks only take plain_text, mrkdwn is ignored here
        text: { type: 'plain_text', text: '📊 Daily Attribution Report - BooleanMaths', emoji: true },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `*${client_name}*  |  Date: ${date}` }],
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          // slack mrkdwn uses single asterisks for bold, double renders literally
          { type: 'mrkdwn', text: `*💰 Total Ad Spend:*\n${formatCurrency(spend_cents)}` },
          { type: 'mrkdwn', text: `*🛒 Total Revenue:*\n${formatCurrency(revenue_cents)}` },
          { type: 'mrkdwn', text: `*📈 ROAS:*\n${formatRoas(roas)}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '_Generated automatically by BooleanMaths_' }],
      },
    ],
  };
}
