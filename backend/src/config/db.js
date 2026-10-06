import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/*
  MongoDB connection. The database is the source of truth for every
  record the admin and the public forms create.

  strictQuery keeps unknown filter keys out of queries. Query-operator
  injection is prevented where filters are built: request values are
  validated as plain strings before they reach a query (see
  utils/query.js and the zod validators), so an object such as
  { "$ne": null } can never arrive as a filter value.
*/
mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.mongodbUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });
  logger.info('database.connected', { host: mongoose.connection.host, name: mongoose.connection.name });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function databaseReady() {
  return mongoose.connection.readyState === 1;
}
