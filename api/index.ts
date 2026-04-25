import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import debateRoutes from '../src/server/routes/debate.routes';
import authRoutes from '../src/server/routes/auth.routes';
import codeRoutes from '../src/server/routes/code.routes';
import ragRoutes from '../src/server/routes/rag.routes';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// API Routes
app.use('/api/debate', debateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/rag', ragRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: 'vercel-serverless-prod' });
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Global Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack
  });
});

export default app;
