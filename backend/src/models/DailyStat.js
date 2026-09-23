import mongoose from 'mongoose';

// money is stored in integer cents everywhere, converted to dollars only when formatting
const dailyStatSchema = new mongoose.Schema(
  {
    client_id: { type: String, required: true, ref: 'Client' },
    date: { type: Date, required: true },
    channel: { type: String, required: true },
    spend_cents: { type: Number, required: true, min: 0 },
    revenue_cents: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'daily_stats' }
);

// the aggregation filters by client and date range, so index both
dailyStatSchema.index({ client_id: 1, date: 1 });

export default mongoose.model('DailyStat', dailyStatSchema);
