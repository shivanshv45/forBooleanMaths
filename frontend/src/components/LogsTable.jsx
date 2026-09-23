import { formatCurrency, formatDate, formatRoas, formatTime } from '../api/format.js';

export default function LogsTable({ logs, loading }) {
  if (loading && !logs.length) {
    return <p className="muted">Loading logs...</p>;
  }

  if (!logs.length) {
    return <p className="muted">No reports sent yet. Use "Send test report" to queue one.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Report date</th>
            <th>Status</th>
            <th>Spend</th>
            <th>Revenue</th>
            <th>ROAS</th>
            <th>Attempts</th>
            <th>Sent at</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log._id}>
              <td>{formatDate(log.report_date)}</td>
              <td>
                <span className={`pill ${log.status}`}>{log.status}</span>
              </td>
              <td>{formatCurrency(log.spend_cents)}</td>
              <td>{formatCurrency(log.revenue_cents)}</td>
              <td>{formatRoas(log.roas)}</td>
              <td>{log.attempts}</td>
              <td>{formatTime(log.sent_at)}</td>
              <td className="error-cell">{log.last_error || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
