/* 
  API file
  Exposes endpoints to get data from the MongoDB database 
*/
import './config/loadEnv.js';
import { connectDB } from './config/db.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
import cookieParser from 'cookie-parser';

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
app.use(cookieParser());

// CORS configuration
if (process.env.NODE_ENV === 'production') {
  const allowedOrigins = [/\.?megagera\.com$/];

  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.some((regex) => regex.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }, credentials: true
  };

  app.use(cors(corsOptions));
} else {
  app.use(cors());
}

// Validate Api Key
if (process.env.NODE_ENV === 'production') {
  const validateApiKey = async (req, res, next) => {
    try {
      const headers = new Headers({
        Cookie: "access_token=" + req.cookies.access_token
      });
      const validateRequest = new Request(process.env.VALIDATE_URI, {
        headers: headers,
      });
      const validateResponse = await fetch(validateRequest);
      const validateData = await validateResponse.json();
      req.validateData = validateData.data;
      if (validateResponse.status === 200) {
        next();
      } else {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Can\'t validate token from catch' });
    }
  };
  app.use(validateApiKey)
}
// Routes
app.use('/match', matchRoutes);
app.use('/league', leagueRoutes);
app.use('/team', teamRoutes);
app.use('/real_match', realMatchRoutes);
app.use('/location', locationRoutes);

// Start the server
const PORT = process.env.PORT || 3150;

if (process.env.NODE_ENV === 'production') {
  // SSL Options
  const sslOptions = {
    key: fs.readFileSync('/certificates/wildcard/privkey.pem'),
    cert: fs.readFileSync('/certificates/wildcard/fullchain.pem')
  };
  
  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server running with SSL on port ${PORT}`);
  });
} else {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}