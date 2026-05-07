import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config';

export const health = onRequest(
  { region: REGION, timeoutSeconds: 15, cors: true },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    res.status(200).json({
      ok: true,
      service: 'shams-al-asrar-functions',
      region: REGION,
      timestamp: new Date().toISOString(),
    });
  },
);
