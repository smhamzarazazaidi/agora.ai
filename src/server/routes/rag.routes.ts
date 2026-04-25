import express from 'express';
import multer from 'multer';
import { ingestFile } from '../services/rag.service';

const router = express.Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype } = req.file;
    if (mimetype !== 'application/pdf' && mimetype !== 'text/plain') {
      return res.status(400).json({ error: 'Only PDF and TXT files are supported' });
    }

    const chunkCount = await ingestFile(buffer, mimetype);
    res.json({ success: true, chunks: chunkCount });
  } catch (err: any) {
    console.error('[RAG Upload Error]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
