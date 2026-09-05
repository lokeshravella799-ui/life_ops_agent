import express from 'express';
import cors from 'cors';
import { env, validateEnvironment } from './config/env';
import { agentRouter } from './routes/agent';
import { paymentRouter } from './routes/payment';
import { logger } from './utils/logger';

const app = express();
const PORT = env.PORT || 3001;

// Startup Environment Validation
const envValidation = validateEnvironment();
if (envValidation.errors.length > 0) {
  envValidation.errors.forEach((err) => {
    logger.warn(`[CONFIG WARNING] ${err}`);
  });
}
if (envValidation.warnings.length > 0) {
  envValidation.warnings.forEach((warn) => {
    logger.info(`[CONFIG INFO] ${warn}`);
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/agent', agentRouter);
app.use('/api/payment', paymentRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'LifeOps Agent Core',
    version: '2.0.0',
    llmProvider: env.LLM_PROVIDER,
    llmModel: env.LLM_MODEL,
    timestamp: new Date().toISOString(),
  });
});

export const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`LifeOps Agent Core backend listening on port ${PORT} [LLM: ${env.LLM_PROVIDER.toUpperCase()} / Model: ${env.LLM_MODEL}]`);
});

export default app;

