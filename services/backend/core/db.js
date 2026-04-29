import { MesahubClient } from '@mesahub/client';
import config from './config.js';
import logger from './logger.js';

/**
 * Parse a `mh://` connection string into its component parts.
 * The `mh://local/dbname` placeholder must be rewritten by start.sh before
 * the process starts — this function only handles concrete `mh://key@host/db` URLs.
 */
function parseMesahubUrl(raw) {
  if (!raw.startsWith('mh://')) {
    throw new Error(`Invalid MESAHUB_URL: must start with mh:// (got: ${JSON.stringify(raw.slice(0, 30))})`);
  }
  const parsed = new URL(raw.replace(/^mh:\/\//, 'http://'));
  const host = parsed.hostname;
  if (host === 'local') {
    throw new Error(
      'mh://local/... is the embedded-mode placeholder — start.sh must rewrite ' +
      'MESAHUB_URL to mh://token@localhost:PORT/db before the application starts.',
    );
  }
  const isPrivate = host === 'localhost' || host === '127.0.0.1' || !host.includes('.') || host.endsWith('.internal');
  const scheme = isPrivate ? 'http' : 'https';
  const portPart = parsed.port ? `:${parsed.port}` : '';
  const apiUrl = `${scheme}://${host}${portPart}`;
  const apiKey = decodeURIComponent(parsed.username);
  if (!apiKey) throw new Error('MESAHUB_URL must include an API key: mh://apikey@host/dbname');
  const dbName = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!dbName) throw new Error('MESAHUB_URL must include a database name: mh://apikey@host/dbname');
  return { apiUrl, apiKey, dbName };
}

/**
 * Convert a SQL string + params (positional array OR named object `:key` style)
 * into the positional-array format required by the mesahub client.
 */
function toPositional(sql, params) {
  if (!params || Array.isArray(params)) {
    return { sql, bindings: params || [] };
  }
  const bindings = [];
  const converted = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    bindings.push(params[name]);
    return '?';
  });
  return { sql: converted, bindings };
}

/**
 * Async SQLite-over-HTTP database client (mesahub).
 */
class DatabaseManager {
  constructor() {
    this._db = null;
  }

  async initialize() {
    const { apiUrl, apiKey, dbName } = parseMesahubUrl(config.mesahubUrl);
    const client = new MesahubClient({ apiKey, apiUrl, routePrefix: 'api' });
    this._db = client.db(dbName);

    await this._initializeSchema();
    logger.info({ dbName }, 'Database initialized');
  }

  /**
   * Add columns/tables that don't exist yet (safe to run on every boot).
   */
  async _runMigrations() {
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
        await this._db.exec(sql);
      } catch {
        // Column/index already exists — ignore
      }
    }
  }

  async _initializeSchema() {
    await this._db.exec(`
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

    await this._runMigrations();

    await this._db.exec(`
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

    await this._db.exec(`
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

    await this._db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        schedule TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at INTEGER,
        next_run_at INTEGER
      )
    `);

    await this._db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'admin',
        target TEXT,
        meta TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    await this._db.exec(`
      CREATE INDEX IF NOT EXISTS idx_backups_service_id ON backups(service_id)
    `).catch(() => {});
    await this._db.exec(`
      CREATE INDEX IF NOT EXISTS idx_backups_started_at ON backups(started_at DESC)
    `).catch(() => {});
    await this._db.exec(`
      CREATE INDEX IF NOT EXISTS idx_restores_backup_id ON restores(backup_id)
    `).catch(() => {});
    await this._db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC)
    `).catch(() => {});
  }

  /**
   * Execute a SELECT and return all rows.
   * Accepts positional `[...]` or named `{ key: value }` params.
   */
  async all(sql, params = []) {
    if (!this._db) throw new Error('Database not initialized');
    const { sql: s, bindings } = toPositional(sql, params);
    const result = await this._db.query(s, bindings);
    return result.rows;
  }

  /**
   * Execute a SELECT and return the first row (or undefined).
   */
  async get(sql, params = []) {
    if (!this._db) throw new Error('Database not initialized');
    const { sql: s, bindings } = toPositional(sql, params);
    const result = await this._db.query(s, bindings);
    return result.rows[0];
  }

  /**
   * Execute a write statement (INSERT / UPDATE / DELETE).
   */
  async run(sql, params = []) {
    if (!this._db) throw new Error('Database not initialized');
    const { sql: s, bindings } = toPositional(sql, params);
    return this._db.exec(s, bindings);
  }

  /** No-op: mesahub connections are HTTP — nothing to close. */
  close() {}
}

export default new DatabaseManager();
