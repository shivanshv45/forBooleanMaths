import Client from '../models/Client.js';
import { buildReportPipeline } from './report.pipeline.js';

export function getReportsForDate(reportDate) {
  return Client.aggregate(buildReportPipeline(reportDate));
}
