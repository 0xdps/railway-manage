import cron from 'node-cron';
import { randomUUID } from 'crypto';
import logger from '../core/logger.js';
import db from '../core/db.js';
import config from '../core/config.js';
import railwayClient from '../railway/client.js';

/**
 * Restart monitor — evaluates restart policies every 60 seconds using
 * locally-stored metric_samples.  No Railway API call at decision time.
 *
 * Decision logic:
 *   violation_ratio = fraction of samples in [now - window_minutes] that
 *   exceed the configured threshold.  If >= policy.violation_ratio → restart,
 *   subject to cooldown_minutes since last_triggered_at.
 */
class RestartMonitor {
  constructor() {
    this._task = null;
    this._cronTasks = new Map(); // serviceId → cron task for restart_cron policies
  }

  initialize() {
    // Evaluate threshold policies every 60s (aligned with poller)
    this._task = cron.schedule('* * * * *', () => {
      this._evaluateAll().catch((err) =>
        logger.error(err, 'Restart evaluation failed')
      );
    });

    // Load any existing cron-restart policies
    this._reloadCronTasks();

  }

  // ─── Threshold evaluation ────────────────────────────────────────────────

  async _evaluateAll() {
    const policies = await db.all(
      `SELECT * FROM restart_policies WHERE enabled = 1`
    );
    if (!policies.length) return;

    for (const policy of policies) {
      await this._evaluatePolicy(policy).catch((err) =>
        logger.error({ serviceId: policy.service_id, err: err.message }, 'Policy evaluation error')
      );
    }
  }

  async _evaluatePolicy(policy) {
    const now = Math.floor(Date.now() / 1000);

    // Enforce cooldown
    if (
      policy.last_triggered_at &&
      now - policy.last_triggered_at < policy.cooldown_minutes * 60
    ) {
      return;
    }

    const windowStart = now - policy.window_minutes * 60;

    let triggered = false;
    let reason = null;

    if (policy.cpu_threshold != null) {
      const row = await db.get(
        `SELECT
           COUNT(*) FILTER (WHERE value > ?) AS violations,
           COUNT(*) AS total
         FROM metric_samples
         WHERE service_id = ? AND measurement = 'CPU_USAGE' AND ts >= ?`,
        [policy.cpu_threshold, policy.service_id, windowStart]
      );
      if (row?.total >= 3 && row.violations / row.total >= policy.violation_ratio) {
        triggered = true;
        reason = `CPU ${(policy.cpu_threshold * 100).toFixed(0)}% threshold breached (${row.violations}/${row.total} samples)`;
      }
    }

    if (!triggered && policy.mem_threshold_gb != null) {
      const row = await db.get(
        `SELECT
           COUNT(*) FILTER (WHERE value > ?) AS violations,
           COUNT(*) AS total
         FROM metric_samples
         WHERE service_id = ? AND measurement = 'MEMORY_USAGE_GB' AND ts >= ?`,
        [policy.mem_threshold_gb, policy.service_id, windowStart]
      );
      if (row?.total >= 3 && row.violations / row.total >= policy.violation_ratio) {
        triggered = true;
        reason = `Memory ${policy.mem_threshold_gb} GB threshold breached (${row.violations}/${row.total} samples)`;
      }
    }

    if (triggered) {
      await this._triggerRestart(policy.service_id, reason);
    }
  }

  // ─── Scheduled (cron) restarts ───────────────────────────────────────────

  _reloadCronTasks() {
    // Stop all existing scheduled restarts
    for (const task of this._cronTasks.values()) task.stop();
    this._cronTasks.clear();

    db.all(
      `SELECT service_id, restart_cron FROM restart_policies
       WHERE enabled = 1 AND restart_cron IS NOT NULL AND restart_cron != ''`
    ).then((policies) => {
      for (const p of policies) {
        this._scheduleCron(p.service_id, p.restart_cron);
      }
    }).catch((err) => logger.error(err, 'Failed to reload cron tasks'));
  }

  _scheduleCron(serviceId, cronExpr) {
    if (!cron.validate(cronExpr)) {
      logger.warn({ serviceId, cronExpr }, 'Invalid restart_cron expression — skipping');
      return;
    }
    const task = cron.schedule(cronExpr, () => {
      this._triggerRestart(serviceId, 'Scheduled restart (cron)').catch((err) =>
        logger.error({ serviceId, err: err.message }, 'Scheduled restart failed')
      );
    });
    this._cronTasks.set(serviceId, task);
    logger.info({ serviceId, cronExpr }, 'Cron restart scheduled');
  }

  // Called by policy route after a PUT to reload cron tasks immediately
  reloadPolicy(serviceId, policy) {
    // Remove old cron task for this service
    if (this._cronTasks.has(serviceId)) {
      this._cronTasks.get(serviceId).stop();
      this._cronTasks.delete(serviceId);
    }
    // Re-schedule if applicable
    if (policy.enabled && policy.restart_cron) {
      this._scheduleCron(serviceId, policy.restart_cron);
    }
  }

  // ─── Actual restart ──────────────────────────────────────────────────────

  async _triggerRestart(serviceId, reason) {
    try {
      logger.warn({ serviceId, reason }, 'Auto-restart triggered');

      await railwayClient.redeployService(serviceId, config.railwayEnvironmentId);

      const now = Math.floor(Date.now() / 1000);
      await db.run(
        `UPDATE restart_policies SET last_triggered_at = ? WHERE service_id = ?`,
        [now, serviceId]
      );

      await db.run(
        `INSERT INTO audit_log (id, action, actor, target, meta, created_at)
         VALUES (?, 'service.auto_restart', 'restart-monitor', ?, ?, ?)`,
        [randomUUID(), serviceId, JSON.stringify({ reason }), now]
      );

      logger.info({ serviceId, reason }, 'Auto-restart complete');
    } catch (err) {
      logger.error({ serviceId, err: err.message }, 'Auto-restart failed');
    }
  }

  stop() {
    if (this._task) { this._task.stop(); this._task = null; }
    for (const task of this._cronTasks.values()) task.stop();
    this._cronTasks.clear();
  }
}

export default new RestartMonitor();
