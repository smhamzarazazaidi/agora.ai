import { Router, Request, Response } from 'express';
import { runDebate } from '../services/debate.service';
import { runContinuation } from '../services/continuation.service';
import { runGraphReasoning } from '../ai/graph/graph';
import { StartDebateRequest, ContinueDebateRequest, GraphReasoningRequest } from '../../shared/types';
import { protect, AuthRequest } from '../middleware/auth';
import { Debate } from '../config/mockDb';

const router = Router();

router.use(protect);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const debates = await Debate.find({ userId: req.user!.userId }).sort({ createdAt: -1 });
    res.json(debates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const debate = await Debate.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!debate) return res.status(404).json({ error: 'Not found' });
    res.json(debate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await Debate.findOneAndDelete({ _id: req.params.id, userId: req.user!.userId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debate/start  — SSE streaming endpoint
router.post('/start', async (req: AuthRequest, res: Response) => {
  const { idea, rounds = 3, mode = 'fast' } = req.body as StartDebateRequest;

  if (!idea || !idea.trim()) {
    res.status(400).json({ error: 'idea is required' });
    return;
  }

  const clampedRounds = Math.min(5, Math.max(1, Number(rounds)));

  let debateDoc;
  try {
    debateDoc = await Debate.create({
      userId: req.user!.userId,
      idea: idea.trim(),
      rounds: clampedRounds,
      mode,
      status: 'running',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
    return;
  }

  // ─── SSE headers ───
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  // Send the initial debate ID to the client so it can attach to the right UI state
  res.write(`data: ${JSON.stringify({ type: 'init', debateId: debateDoc._id.toString() })}\n\n`);

  // Keep-alive ping
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);

  req.on('close', () => clearInterval(ping));

  try {
    await runDebate(res, req.user!.userId, debateDoc._id.toString(), idea.trim(), clampedRounds, mode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await Debate.findByIdAndUpdate(debateDoc._id, { status: 'error' });
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
  } finally {
    clearInterval(ping);
    res.end();
  }
});

// POST /api/debate/continue — SSE streaming continuation after verdict
router.post('/continue', async (req: AuthRequest, res: Response) => {
  const { debateId, followUp, intensity = 'high' } = req.body as ContinueDebateRequest;

  if (!debateId || !followUp?.trim()) {
    res.status(400).json({ error: 'debateId and followUp are required' });
    return;
  }

  const debate = await Debate.findById(debateId);
  if (!debate) return res.status(404).json({ error: 'Debate not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => clearInterval(ping));

  try {
    if (debate.mode === 'deep') {
      // Use graph reasoning for follow-up in deep mode
      await runGraphReasoning(res, req.user!.userId, debateId, debate.idea, 3, followUp.trim());
    } else {
      // Standard multi-agent continuation
      await runContinuation(res, debateId, followUp.trim(), intensity);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
  } finally {
    clearInterval(ping);
    res.end();
  }
});


// POST /api/debate/reason — Graph-based autonomous reasoning (SSE)
router.post('/reason', async (req: AuthRequest, res: Response) => {
  const { idea, maxIterations = 3 } = req.body as GraphReasoningRequest;

  if (!idea || !idea.trim()) {
    res.status(400).json({ error: 'idea is required' });
    return;
  }

  const clampedIterations = Math.min(5, Math.max(1, Number(maxIterations)));

  let debateDoc;
  try {
    debateDoc = await Debate.create({
      userId: req.user!.userId,
      idea: idea.trim(),
      rounds: clampedIterations,
      mode: 'deep',
      status: 'running',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
    return;
  }

  // ─── SSE headers ───
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'init', debateId: debateDoc._id.toString() })}\n\n`);

  // Keep-alive ping
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => clearInterval(ping));

  try {
    await runGraphReasoning(res, req.user!.userId, debateDoc._id.toString(), idea.trim(), clampedIterations);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await Debate.findByIdAndUpdate(debateDoc._id, { status: 'error' });
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
  } finally {
    clearInterval(ping);
    res.end();
  }
});

export default router;
