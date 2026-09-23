import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const SLACK_URL = /^https:\/\/hooks\.slack\.com\/services\/.+/;
const LOCAL_URL = /^https?:\/\/localhost(:\d+)?\//;

function validate(url) {
  if (!url.trim()) return 'Webhook URL is required';
  if (!SLACK_URL.test(url) && !LOCAL_URL.test(url)) {
    return 'Must be a https://hooks.slack.com/services/... URL';
  }
  return null;
}

export default function SettingsCard({ client, onSaved }) {
  const [webhook, setWebhook] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  // reset the form whenever a different client is picked
  useEffect(() => {
    setWebhook(client.slack_webhook_url || '');
    setEnabled(client.slack_notifications_enabled);
    setStatus(null);
  }, [client]);

  async function save() {
    const error = validate(webhook);
    if (error) {
      setStatus({ type: 'error', message: error });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateClient(client._id, {
        slack_webhook_url: webhook.trim(),
        slack_notifications_enabled: enabled,
      });
      setStatus({ type: 'ok', message: 'Saved' });
      onSaved(updated);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  // the toggle saves on its own, nobody expects to press save after flipping a switch
  async function toggle(next) {
    setEnabled(next);
    try {
      const updated = await api.updateClient(client._id, { slack_notifications_enabled: next });
      setStatus({ type: 'ok', message: next ? 'Reports enabled' : 'Reports disabled' });
      onSaved(updated);
    } catch (err) {
      setEnabled(!next);
      setStatus({ type: 'error', message: err.message });
    }
  }

  return (
    <section className="card">
      <h2>Slack settings</h2>

      <label className="field">
        <span>Webhook URL</span>
        <input
          type="text"
          value={webhook}
          placeholder="https://hooks.slack.com/services/..."
          onChange={(e) => setWebhook(e.target.value)}
        />
      </label>

      <label className="toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        <span>Send daily reports to Slack</span>
      </label>

      <div className="row">
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save webhook'}
        </button>
        {status && <span className={`status ${status.type}`}>{status.message}</span>}
      </div>
    </section>
  );
}
