import cron from 'node-cron';
import logger from '../core/logger.js';
import db from '../core/db.js';
import config from '../core/config.js';
import railwayClient from '../railway/client.js';

/**
 * Metrics poller — runs every 60 seconds.
 *
 * For each Railway service in the project:
 *   1. Fetch last 65-minute series for CPU_USAGE + MEMORY_USAGE_GB
 *   2. INSERT OR IGNORE new samples into metric_samples (ts-based dedup)
 *   3. DELETE samples older than 3 hours (rolling window)
 */
class MetricsPoller {
  constructor() {
    this._task = null;
    this._running = false;
  }

  initialize() {
    // On boot: backfill the full 3h display window (185 = 180min + 5min jitter buffer)
    this._collect(185).catch((err) => logger.error(err, 'Initial metrics backfill failed'));

    // Recurring: fetch last 60min + 5min overlap to cover cron jitter; INSERT OR IGNORE deduplicates
    this._task = cron.schedule('* * * * *', () => {
      if (this._running) return; // skip if previous run is still in flight
      this._collect(65).catch((err) => logger.error(err, 'Metrics poll failed'));
    });
  }

  async _collect(windowMinutes = 65) {
    this._running = true;
    try {
      const services = await railwayClient.getServices(
        config.railwayProjectId,
        config.railwayEnvironmentId
      );

      if (!services?.length) return;

      const cutoff = Math.floor(Date.now() / 1000) - 3 * 60 * 60; // 3 hours ago

      // Collect all services in parallel
      const results = await Promise.allSettled(
        services.map((svc) =>
          railwayClient.getServiceMetricsSeries(svc.id, windowMinutes)
            .then((series) => ({ id: svc.id, series }))
            .catch((err) => {
              logger.warn({ serviceId: svc.id, err: err.message }, 'Failed to fetch metrics series');
              return null;
            })
        )
      );

      // Write all samples (INSERT OR IGNORE deduplicates by primary key)
      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const { id, series } = result.value;

        for (const { ts, value } of series.cpu) {
          await db.run(
            `INSERT OR IGNORE INTO metric_samples (service_id, measurement, ts, value) VALUES (?, ?, ?, ?)`,
            [id, 'CPU_USAGE', ts, value]
          );
        }
        for (const { ts, value } of series.mem) {
          await db.run(
            `INSERT OR IGNORE INTO metric_samples (service_id, measurement, ts, value) VALUES (?, ?, ?, ?)`,
            [id, 'MEMORY_USAGE_GB', ts, value]
          );
        }
      }

      await db.run(`DELETE FROM metric_samples WHERE ts < ?`, [cutoff]);

      logger.debug({ count: services.length, cutoff }, 'Metrics poll complete');
    } catch (err) {
      logger.error(err, 'Metrics collection error');
    } finally {
      this._running = false;
    }
  }

  stop() {
    if (this._task) {
      this._task.stop();
      this._task = null;
    }
  }
}

export default new MetricsPoller();
