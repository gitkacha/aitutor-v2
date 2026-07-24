import 'dotenv/config'; // loads backend/.env; never overrides variables already set
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import { errorHandler } from './middleware/error';
import { attachUser } from './middleware/auth';
import authRouter from './routes/auth';
import setupRouter from './routes/setup';
import workspaceUsersRouter from './routes/workspace-users';
import superadminRouter from './routes/superadmin';
import typesRouter from './routes/types';
import attemptsRouter from './routes/attempts';
import heatmapRouter from './routes/heatmap';
import analysisRouter from './routes/analysis';
import worksheetsRouter from './routes/worksheets';
import demoRouter from './routes/demo';
import statsRouter from './routes/stats';
import mathTopicsRouter from './routes/math-topics';
import mathQuestionsRouter from './routes/math-questions';
import mathAttemptsRouter from './routes/math-attempts';
import mathHeatmapRouter from './routes/math-heatmap';
import mathWorksheetsRouter from './routes/math-worksheets';
import skillsRouter from './routes/skills';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
// Signed HTTP-only session cookie holding { userId } (Milestone 2). The identity
// provider behind /api/auth is swappable; the session mechanics are not provider-specific.
app.use(cookieSession({
  name: 'coach_session',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
}));
app.use(attachUser);

app.use('/api/auth', authRouter);
app.use('/api/setup', setupRouter);
app.use('/api/workspace/users', workspaceUsersRouter);
app.use('/api/superadmin', superadminRouter);

app.use('/api/types', typesRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/worksheets', worksheetsRouter);
app.use('/api/demo', demoRouter);
app.use('/api/stats', statsRouter);

app.use('/api/math/topics', mathTopicsRouter);
app.use('/api/math/questions', mathQuestionsRouter);
app.use('/api/math/attempts', mathAttemptsRouter);
app.use('/api/math/heatmap', mathHeatmapRouter);
app.use('/api/math/worksheets', mathWorksheetsRouter);

app.use('/api/skills', skillsRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;