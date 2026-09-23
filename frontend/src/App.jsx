import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client.js';
import SettingsCard from './components/SettingsCard.jsx';
import LogsTable from './components/LogsTable.jsx';

export default function App() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [logs, setLogs] = useState([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState(null);
  const [canForce, setCanForce] = useState(false);

  useEffect(() => {
    api
      .listClients()
      .then((rows) => {
        setClients(rows);
        setSelectedId(rows[0]?._id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    if (!selectedId) return;

    try {
      const [rows, queue] = await Promise.all([api.getLogs(selectedId), api.getQueueDepth()]);
      setLogs(rows);
      setQueueDepth(queue.pending);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [selectedId]);

  // poll so the table can be watched draining while the worker runs
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  async function trigger(force = false) {
    setTriggering(true);
    setNotice(null);
    try {
      const summary = await api.triggerRun(force);
      setNotice(
        summary.queued
          ? `Queued ${summary.queued}${summary.skipped ? `, skipped ${summary.skipped}` : ''}`
          : `Skipped all ${summary.skipped} - already sent for ${summary.reportDate}`
      );
      // nothing queued means the day is already claimed, so offer the override
      setCanForce(summary.queued === 0 && summary.skipped > 0);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  }

  const selected = clients.find((c) => c._id === selectedId);

  if (loading) return <main className="app"><p className="muted">Loading...</p></main>;

  return (
    <main className="app">
      <header>
        <div>
          <h1>Slack Report Dispatcher</h1>
          <p className="muted">Daily attribution reports, queued and rate limited</p>
        </div>
        <span className="queue">Queue: {queueDepth}</span>
      </header>

      {error && <div className="banner error">{error}</div>}

      {!clients.length ? (
        <div className="banner">No clients found. Run the seed script first.</div>
      ) : (
        <>
          <section className="card">
            <label className="field">
              <span>Client</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c._id})
                  </option>
                ))}
              </select>
            </label>
          </section>

          {selected && (
            <SettingsCard
              client={selected}
              onSaved={(updated) =>
                setClients((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
              }
            />
          )}

          <section className="card">
            <div className="row spread">
              <h2>Notification logs</h2>
              <div className="row">
                {canForce && (
                  <button onClick={() => trigger(true)} disabled={triggering}>
                    Send again
                  </button>
                )}
                <button className="primary" onClick={() => trigger(false)} disabled={triggering}>
                  {triggering ? 'Queueing...' : 'Send test report'}
                </button>
              </div>
            </div>
            {notice && <p className="status ok">{notice}</p>}
            <LogsTable logs={logs} loading={loading} />
          </section>
        </>
      )}
    </main>
  );
}
