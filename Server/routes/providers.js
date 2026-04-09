import express from 'express';
import fs from 'fs';
import { scramjetPath } from '@mercuryworkshop/scramjet';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { getAllProviderConfigs, getProviderConfig } from '../config/providers.js';

const router = express.Router();

/**
 * GET /api/providers
 * List all providers and their availability.
 */
router.get('/', (_req, res) => {
  const providers = getAllProviderConfigs().map((p) => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
  }));
  res.json(providers);
});

/**
 * GET /api/providers/:id/status
 * Health check — verifies the provider's dist files are present on disk.
 */
router.get('/:id/status', (req, res) => {
  const config = getProviderConfig(req.params.id);
  if (!config) {
    return res.status(404).json({ available: false, message: 'Provider not found' });
  }
  if (!config.enabled) {
    return res.json({ available: false, message: 'Disabled by server configuration' });
  }

  const distPath = config.id === 'scramjet' ? scramjetPath : uvPath;
  const exists = fs.existsSync(distPath);

  res.json({
    available: exists,
    message: exists ? 'Provider ready' : 'Distribution files not found',
  });
});

export default router;
