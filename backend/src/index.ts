import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import typesRouter from './routes/types';
import attemptsRouter from './routes/attempts';
import heatmapRouter from './routes/heatmap';
import analysisRouter from './routes/analysis';
import worksheetsRouter from './routes/worksheets';
import demoRouter from './routes/demo';
import mathTopicsRouter from './routes/math-topics';
import mathQuestionsRouter from './routes/math-questions';
import mathAttemptsRouter from './routes/math-attempts';
import mathHeatmapRouter from './routes/math-heatmap';
import mathWorksheetsRouter from './routes/math-worksheets';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/types', typesRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/worksheets', worksheetsRouter);
app.use('/api/demo', demoRouter);

app.use('/api/math/topics', mathTopicsRouter);
app.use('/api/math/questions', mathQuestionsRouter);
app.use('/api/math/attempts', mathAttemptsRouter);
app.use('/api/math/heatmap', mathHeatmapRouter);
app.use('/api/math/worksheets', mathWorksheetsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;