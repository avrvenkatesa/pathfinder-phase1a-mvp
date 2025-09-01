import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { createValidationRoutes } from './routes/validation';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.VALIDATION_SERVICE_PORT || 3004;

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.VALIDATION_RATE_LIMIT ? parseInt(process.env.VALIDATION_RATE_LIMIT) : 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many validation requests from this IP, please try again later.'
});
app.use('/api/validation', limiter);

// Routes
app.use('/api/validation', createValidationRoutes(db));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'validation-service',
    timestamp: new Date() 
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Validation service error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(port, () => {
  console.log(`Validation service running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API docs: http://localhost:${port}/api/validation`);
});

export { app, db };