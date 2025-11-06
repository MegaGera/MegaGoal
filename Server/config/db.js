import { MongoClient } from 'mongodb';
import { ensureIndexes } from './indexes.js';

let client;
let db;

const connectDB = async () => {
  if (!client) {
    try {
      client = new MongoClient(process.env.MONGO_URI);
      await client.connect();
      db = client.db(process.env.DB_NAME);
      console.log('MongoDB connected');
      
      // Create indexes after connection is established
      await ensureIndexes();
    } catch (error) {
      console.error('Error connecting to MongoDB', error);
      process.exit(1);
    }
  }
  return db;
};

const getDB = () => db;

export { connectDB, getDB };