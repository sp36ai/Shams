/**
 * health.ts — Readiness/liveness check for Shams al-Asrār.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config';
import { ENGINE_VERSION } from '../engine/primitives/chartBuilder';
import { logger } from '../utils/logger';

export const health = onRequest(
  { region: REGION, timeoutSeconds: 10, cors: true },
  async (_req, res) => {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      engine: {
        version: ENGINE_VERSION,
        region: REGION,
      },
      projectId: process.env.GCLOUD_PROJECT,
    };

    logger.info('Health check pinged', status);
    res.status(200).json(status);
  },
);
