import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export async function connectMongo() {
  mongoose.connection.on('error', (err) => {
    logger.error('mongo', 'connection error', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('mongo', 'disconnected');
  });

  await mongoose.connect(config.mongoUri);
  logger.info('mongo', 'connected');

  return mongoose.connection;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
  logger.info('mongo', 'disconnected');
}

// 1 = connected, per mongoose readyState
export function isMongoHealthy() {
  return mongoose.connection.readyState === 1;
}
