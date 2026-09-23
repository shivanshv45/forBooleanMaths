import mongoose from 'mongoose';

export const LOG_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
};

// metrics are copied onto the log so it shows what was actually sent,
// even if the underlying stats get corrected later
const notificationLogSchema = new mongoose.Schema(
  {
    client_id: { type: String, required: true, ref: 'Client' },
    client_name: { type: String, required: true },
    report_date: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(LOG_STATUS),
      default: LOG_STATUS.PENDING,
    },
    attempts: { type: Number, default: 0 },
    last_error: { type: String, default: null },
    sent_at: { type: Date, default: null },
    spend_cents: { type: Number, required: true },
    revenue_cents: { type: Number, required: true },
    roas: { type: Number, default: null },
  },
  { timestamps: true, collection: 'notification_logs' }
);

// dashboard always asks for one client's most recent logs
notificationLogSchema.index({ client_id: 1, createdAt: -1 });

export default mongoose.model('NotificationLog', notificationLogSchema);
