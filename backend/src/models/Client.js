import mongoose from 'mongoose';

// string _id so it joins cleanly with daily_stats.client_id, per the spec's mock data
const clientSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    slack_notifications_enabled: { type: Boolean, default: false },
    slack_webhook_url: { type: String, default: '', trim: true },
  },
  { timestamps: true, collection: 'clients', _id: false }
);

export default mongoose.model('Client', clientSchema);
