/**
 * health.ts — Readiness/liveness check for Shams al-Asrār.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config';
import { ENGINE_VERSION } from '../engine/primitives/chartBuilder';
import { logger } from '../utils/logger';

export const health = onRequest(
  { region: REGION, timeoutSeconds: 10, cors: false },
  async (_req, res) => {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
    };

    logger.info('Health check pinged', status);
    res.status(200).json(status);
  },
);
