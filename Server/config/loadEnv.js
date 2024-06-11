import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

if (!process.env.MONGO_URI || !process.env.DB_NAME) {
  console.error('Missing environment variables: MONGO_URI or DB_NAME');
  process.exit(1);
}