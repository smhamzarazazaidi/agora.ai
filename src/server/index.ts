import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// MongoDB disabled: IP not whitelisted on Atlas. Using mockDb.
import debateRoutes from './routes/debate.routes';
import authRoutes from './routes/auth.routes';
import codeRoutes from './routes/code.routes';
import ragRoutes from './routes/rag.routes';

import path from 'path';
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

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(Number(PORT), () => {
    console.log(`🟢 AGORA AI server running on http://localhost:${PORT}`);
    console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
  });
}

export default app;
