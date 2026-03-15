import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath, override: true });

/**
 * Centralized configuration management.
 * Reads from environment variables with validation.
 */
class Config {
  constructor() {
    this.adminKey = this._requireEnv('ADMIN_KEY');
    this.sessionSecret = this._requireEnv('SESSION_SECRET');
    
    // Validate session secret length
    if (this.sessionSecret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }

    this.railwayToken = this._requireEnv('RAILWAY_TOKEN');
    this.railwayProjectId = this._requireEnv('RAILWAY_PROJECT_ID');
    this.railwayEnvironmentId = this._requireEnv('RAILWAY_ENVIRONMENT_ID');

    this.port = parseInt(process.env.PORT || '3000', 10);
    this.dataDir = process.env.DATA_DIR || './data';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.nodeEnv = process.env.NODE_ENV || 'development';
  }

  _requireEnv(key) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value;
  }

  isProduction() {
    return this.nodeEnv === 'production';
  }

  isDevelopment() {
    return this.nodeEnv === 'development';
  }

  getDbPath() {
    return path.join(this.dataDir, 'railway-manage.sqlite');
  }

  getBackupDir() {
    return path.join(this.dataDir, 'backups');
  }
}

export default new Config();
