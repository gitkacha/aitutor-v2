import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import typesRouter from './routes/types';
import attemptsRouter from './routes/attempts';
import heatmapRouter from './routes/heatmap';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/types', typesRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/heatmap', heatmapRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;