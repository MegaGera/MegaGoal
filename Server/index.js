/* 
  API file
  Exposes endpoints to get data from the MongoDB database 
*/
import './config/loadEnv.js';
import { connectDB } from './config/db.js';
import express from 'express';
import cors from 'cors';

import matchRoutes from './routes/matchRoutes.js';
import leagueRoutes from './routes/leagueRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import realMatchRoutes from './routes/realMatchRoutes.js';
import locationRoutes from './routes/locationRoutes.js';

const app = express();

// Connect to database
connectDB();

// Parses incoming requests with JSON payloads 
app.use(express.json())

// Use CORS library for all the routes
app.use(cors())

// Routes
app.use('/match', matchRoutes);
app.use('/league', leagueRoutes);
app.use('/team', teamRoutes);
app.use('/real_match', realMatchRoutes);
app.use('/location', locationRoutes);

// Start the server
const PORT = process.env.PORT || 3150;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));