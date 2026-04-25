import { Router } from 'express';
import { executeJavaScript } from '../tools/sandbox';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/execute', protect, (req, res) => {
  try {
    const { language, code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ status: 'error', output: null, error: 'No code provided' });
    }

    if (language !== 'javascript') {
      return res.status(400).json({ status: 'error', output: null, error: 'Only javascript is supported' });
    }

    const result = executeJavaScript(code);
    
    return res.json({
      status: result.error ? 'error' : 'success',
      output: result.output || null,
      error: result.error
    });

  } catch (err: any) {
    return res.status(500).json({ status: 'error', output: null, error: err.message });
  }
});

export default router;
