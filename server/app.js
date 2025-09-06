import express from 'express';
const app = express();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import morgan from 'morgan';

import userRoutes from './routes/userRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js'; 

import errorMiddleware from './middlewares/error.middleware.js';

config();

// ================= Middlewares =================

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// cookies
app.use(cookieParser());

// cors
app.use(
  cors({
    origin: [process.env.FRONTEND_URL],
    credentials: true,
  })
);

// logging
app.use(morgan('dev'));

// ================= Routes =================
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/issue', issueRoutes);
app.use('/api/v1/departments', departmentRoutes); 

// ================= Error Handler =================
app.use(errorMiddleware);

export default app;
