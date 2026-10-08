import express from 'express';
import multer from 'multer';
import { AnalysisController } from '../controllers/analysis_controller.js';

const router = express.Router();

// Configure multer with in-memory storage (safe limit 500KB per file, max 20 files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024,
    files: 20
  }
});

// Routes
router.get('/health', AnalysisController.getHealth);
router.post('/index', upload.array('files', 20), AnalysisController.indexFiles);
router.post('/analyze', upload.array('files', 20), AnalysisController.analyze);

export default router;
