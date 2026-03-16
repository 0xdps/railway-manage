import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from './config.js';
import logger from './logger.js';

/**
 * SQLite database singleton with schema initialization.
 */
class DatabaseManager {
  constructor() {
    this.db = null;
  }

  initialize() {
    const dbPath = config.getDbPath();
    const dbDir = path.dirname(dbPath);

    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info({ dir: dbDir }, 'Created data directory');
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this._initializeSchema();
    logger.info({ dbPath }, 'Database initialized');
  }

  /**
   * Add columns that don't exist yet (safe to run on every boot).
   */
  _runMigrations() {
    const migrations = [
      `ALTER TABLE services ADD COLUMN railway_service_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE services ADD COLUMN env_var_key TEXT NOT NULL DEFAULT ''`,
      `CREATE TABLE IF NOT EXISTS service_meta (
        service_id TEXT PRIMARY KEY,
        tags       TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      )`,
      // v2 — metric time-series samples (3-hour rolling window)
      `CREATE TABLE IF NOT EXISTS metric_samples (
        service_id  TEXT    NOT NULL,
        measurement TEXT    NOT NULL,
        ts          INTEGER NOT NULL,
        value       REAL    NOT NULL,
        PRIMARY KEY (service_id, measurement, ts)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_metric_samples_lookup
         ON metric_samples(service_id, measurement, ts DESC)`,
      // v2 — restart policies
      `CREATE TABLE IF NOT EXISTS restart_policies (
        service_id          TEXT    PRIMARY KEY,
        enabled             INTEGER NOT NULL DEFAULT 0,
        cpu_threshold       REAL,
        mem_threshold_gb    REAL,
        window_minutes      INTEGER NOT NULL DEFAULT 5,
        violation_ratio     REAL    NOT NULL DEFAULT 0.8,
        restart_cron        TEXT,
        cooldown_minutes    INTEGER NOT NULL DEFAULT 30,
        last_triggered_at   INTEGER,
        updated_at          INTEGER NOT NULL
      )`,
      // v3 — per-service type override
      `ALTER TABLE service_meta ADD COLUMN type_override TEXT`,
    ];
    for (const sql of migrations) {
      try {
        this.db.exec(sql);
      } catch {
        // Column already exists — ignore
      }
    }
  }

  _initializeSchema() {
    // Services to back up - uses Railway env var key instead of storing raw credentials
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        railway_service_id TEXT NOT NULL DEFAULT '',
        env_var_key TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `);

    // Migration: add columns that may be missing from pre-existing databases
    this._runMigrations();

    // Individual backup files
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        schedule TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        size_bytes INTEGER,
        location TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        error TEXT,
        FOREIGN KEY (service_id) REFERENCES services(id)
      )
    `);

    // Restore operations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS restores (
        id TEXT PRIMARY KEY,
        backup_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        status TEXT NOT NULL DEFAULT 'running',
        error TEXT,
        FOREIGN KEY (backup_id) REFERENCES backups(id)
      )
    `);

    // Cron job definitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        schedule TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at INTEGER,
        next_run_at INTEGER
      )
    `);

    // Audit log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'admin',
        target TEXT,
        meta TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Service metadata (tags) keyed by Railway service id
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_meta (
        service_id TEXT PRIMARY KEY,
        tags       TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      )
    `);

    // Create indices for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_backups_service_id 
        ON backups(service_id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_backups_started_at 
        ON backups(started_at DESC)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_restores_backup_id 
        ON restores(backup_id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_created_at 
        ON audit_log(created_at DESC)
    `);
  }

  /**
   * Get a prepared statement.
   */
  prepare(sql) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db.prepare(sql);
  }

  /**
   * Execute a statement and return all rows.
   */
  all(sql, params = {}) {
    return this.prepare(sql).all(params);
  }

  /**
   * Execute a statement and return the first row.
   */
  get(sql, params = {}) {
    return this.prepare(sql).get(params);
  }

  /**
   * Execute a statement and return the result.
   */
  run(sql, params = {}) {
    return this.prepare(sql).run(params);
  }

  /**
   * Execute a transaction.
   */
  transaction(fn) {
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * Close the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default new DatabaseManager();
