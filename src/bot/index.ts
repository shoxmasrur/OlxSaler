import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

logger.info({ env: env.NODE_ENV }, 'Hello');
