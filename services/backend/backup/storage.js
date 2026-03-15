import fs from 'fs';
import path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import config from '../core/config.js';
import logger from '../core/logger.js';

/**
 * VolumeStorage adapter for backing up to mounted volume (/data/backups/)
 * Later can be swapped for R2Storage, S3Storage, etc. with same interface.
 */
class VolumeStorage {
  constructor() {
    this.basePath = config.getBackupDir();
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
      logger.info({ dir: this.basePath }, 'Created backup directory');
    }
  }

  /**
   * Write a stream to storage.
   * Returns { path, size } on success.
   */
  async write(sourceStream, targetPath) {
    const fullPath = path.join(this.basePath, targetPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const writeStream = createWriteStream(fullPath);
      let size = 0;

      writeStream.on('finish', () => {
        logger.info({ path: targetPath, size }, 'Backup written to volume');
        resolve({ path: targetPath, size });
      });

      writeStream.on('error', (err) => {
        logger.error(err, 'Failed to write backup to volume');
        reject(err);
      });

      sourceStream.on('data', (chunk) => {
        size += chunk.length;
      });

      sourceStream.pipe(writeStream);
    });
  }

  /**
   * Read a backup file.
   */
  async read(targetPath) {
    const fullPath = path.join(this.basePath, targetPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Backup not found: ${targetPath}`);
    }

    const stat = fs.statSync(fullPath);
    return {
      stream: createReadStream(fullPath),
      size: stat.size,
    };
  }

  /**
   * List backups matching a prefix.
   */
  async list(prefix = '') {
    const searchPath = prefix ? path.join(this.basePath, prefix) : this.basePath;

    if (!fs.existsSync(searchPath)) {
      return [];
    }

    const results = [];

    function walk(dir, relativeDir = '') {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          const relativePath = relativeDir ? `${relativeDir}/${file}` : file;

          if (stat.isDirectory()) {
            walk(filePath, relativePath);
          } else {
            results.push({
              path: relativePath,
              size: stat.size,
              modified: stat.mtime.getTime(),
            });
          }
        }
      } catch (err) {
        logger.error(err, 'Error walking backup directory');
      }
    }

    walk(searchPath);
    return results;
  }

  /**
   * Delete a backup file.
   */
  async remove(targetPath) {
    const fullPath = path.join(this.basePath, targetPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Backup not found: ${targetPath}`);
    }

    fs.unlinkSync(fullPath);
    logger.info({ path: targetPath }, 'Backup deleted');
  }

  /**
   * Get stats for a file.
   */
  async stat(targetPath) {
    const fullPath = path.join(this.basePath, targetPath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stat = fs.statSync(fullPath);
    return {
      size: stat.size,
      modified: stat.mtime.getTime(),
      path: targetPath,
    };
  }
}

export default new VolumeStorage();
