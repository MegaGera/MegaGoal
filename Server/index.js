/* 
  API file
  Exposes endpoints to get data from the MongoDB database 
*/
import './config/loadEnv.js';
import { connectDB } from './config/db.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import matchRoutes from './routes/matchRoutes.js';
import leagueRoutes from './routes/leagueRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import realMatchRoutes from './routes/realMatchRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import playersRoutes from './routes/playersRoutes.js';


const app = express();

// Connect to database
connectDB();

// Connect to RabbitMQ for logging
connectRabbitMQ();

// Parses incoming requests with JSON payloads 
app.use(express.json())
app.use(cookieParser());

// CORS configuration
if (process.env.NODE_ENV === 'production') {
  console.log("Production mode - cors")
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
  
  // Normal use in development
  app.use(cors());

  // Only use if send credentials in development
  // app.use(cors({
  //   origin: 'http://localhost:3000',
  //   credentials: true,
  // }));
}

// Public routes (no authentication required) - must be defined before middleware
app.use('/public/match', matchRoutes);

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
      return res.status(401).json({ error: 'Can\'t validate token' });
    }
  };
  app.use(validateApiKey)
} else if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    req.validateData = { username: process.env.WEB_USERNAME || 'test' };
    next();
  });
}

const validateAdmin = async (req, res, next) => {
  // Validate Admin permissions
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log("Let's validate Admin")
      const headers = new Headers({
        Cookie: "access_token=" + req.cookies.access_token
      });
      const validateRequest = new Request(process.env.VALIDATE_URI_ADMIN, {
        headers: headers,
      });
      const validateResponse = await fetch(validateRequest);
      const validateData = await validateResponse.json();
      req.validateData = validateData.data;
      if (validateResponse.status === 200) {
        next();
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Can\'t validate token' });
    }
  } else if (process.env.NODE_ENV === 'development') {
    next();
  }
};

// Protected routes (authentication required)
app.use('/match', matchRoutes);
app.use('/league', leagueRoutes);
app.use('/team', teamRoutes);
app.use('/real_match', realMatchRoutes);
app.use('/location', locationRoutes);
app.use('/admin', validateAdmin, adminRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/players', playersRoutes);

// Start the server
const PORT = process.env.PORT || 3150;

// if (process.env.NODE_ENV === 'production') {
//   // SSL Options
//   const sslOptions = {
//     key: fs.readFileSync('/certificates/privkey.pem'),
//     cert: fs.readFileSync('/certificates/fullchain.pem')
//   };
  
//   https.createServer(sslOptions, app).listen(PORT, () => {
//     console.log(`Server running with SSL on port ${PORT}`);
//   });
// } else {
//   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// }
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));