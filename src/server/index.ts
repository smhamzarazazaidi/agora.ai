import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
// MongoDB disabled: IP not whitelisted on Atlas. Using mockDb.
import debateRoutes from './routes/debate.routes';
import authRoutes from './routes/auth.routes';
import codeRoutes from './routes/code.routes';
import ragRoutes from './routes/rag.routes';

dotenv.config();

const rootPath = process.cwd();

const app = express();
const PORT = process.env.PORT || 5000;

// DB connection skipped — using local mockDb (db.json)

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve static files from the project root (where genduet.html lives)
app.use(express.static(rootPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(rootPath, 'genduet.html'));
});

// ─── Routes ───
app.use('/api/debate', debateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/rag', ragRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', provider: process.env.AI_PROVIDER || 'openai' });
});
const errorLogPath = path.join(process.cwd(), 'server-error.log');

app.use((err: any, req: any, res: any, next: any) => {
  const errorDetail = `
[${new Date().toISOString()}] ${req.method} ${req.url}
Error: ${err.message}
Stack: ${err.stack}
--------------------------------------------------
`;
  console.error('[Global Error]', err);
  fs.appendFileSync(errorLogPath, errorDetail);
  
  if (res.headersSent) return next(err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack
  });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const server = app.listen(Number(PORT), () => {
    console.log(`🟢 AGORA AI server running on http://localhost:${PORT}`);
    console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please stop any other running instances of AGORA.`);
      process.exit(1);
    } else {
      console.error(`❌ Server error:`, err);
    }
  });
}

export default app;
