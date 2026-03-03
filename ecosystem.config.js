/**
 * ecosystem.config.js — SUPERSEDED
 * ──────────────────────────────────
 * This project uses "type": "module" in package.json, which means Node.js
 * treats .js files as ESM. PM2 requires a CommonJS config file.
 *
 * USE ecosystem.config.cjs INSTEAD:
 *   pm2 start ecosystem.config.cjs   ← correct command
 *   pm2 restart skoll-ml                   # restart
 *   pm2 stop    skoll-ml                   # stop
 *   pm2 logs    skoll-ml                   # tail logs
 *   pm2 monit                              # live process monitor
 *   pm2 save && pm2 startup                # persist across reboots
 *
 * ── Install prerequisites ──────────────────────────────────────────────────────
 *   npm install -g pm2
 *   npm install @tensorflow/tfjs-node ws node-fetch dotenv
 */

'use strict';

module.exports = {
  apps: [
    {
      // ── Identity ──────────────────────────────────────────────────────────
      name:         'skoll-ml',
      script:       './server.js',
      cwd:          __dirname,

      // ── Process model ─────────────────────────────────────────────────────
      instances:    1,               // 1 process — tfjs-node is not cluster-safe
      exec_mode:    'fork',          // fork mode (not cluster) for TF native addons

      // ── Auto-restart policy ───────────────────────────────────────────────
      autorestart:  true,
      watch:        false,           // don't restart on file changes in prod
      max_restarts: 10,              // give up after 10 rapid crashes
      restart_delay: 4000,           // wait 4s between restarts
      min_uptime:   '10s',           // must stay alive ≥10s to count as "started"

      // ── Memory guard ─────────────────────────────────────────────────────
      max_memory_restart: '1G',      // restart if TF leaks past 1 GB

      // ── Node.js tuning ───────────────────────────────────────────────────
      node_args:    '--max-old-space-size=768',  // cap V8 heap at 768 MB

      // ── Environment — production ─────────────────────────────────────────
      env: {
        NODE_ENV:           'production',
        PORT:               '8080',
        MODEL_PATH:         './public/models/skoll-lstm-v1/model.json',
        FETCH_INTERVAL_MS:  '60000',   // pull NOAA every 60 seconds
        LOG_LEVEL:          'info',
      },

      // ── Environment — development override (pm2 start ... --env dev) ─────
      env_dev: {
        NODE_ENV:           'development',
        PORT:               '8081',
        FETCH_INTERVAL_MS:  '15000',   // faster polling in dev
        LOG_LEVEL:          'debug',
      },

      // ── Logging ──────────────────────────────────────────────────────────
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      out_file:         './logs/skoll-ml-out.log',
      error_file:       './logs/skoll-ml-error.log',
      merge_logs:       true,

      // ── Source map support (useful for TypeScript stack traces) ──────────
      source_map_support: false,

      // ── Health-check hook for PM2+ / Keymetrics ──────────────────────────
      // PM2 polls GET /health and restarts if it returns non-2xx
      // (requires pm2-health or pm2-http-interface plugin)
      // health_check_url: 'http://localhost:8080/health',
    },
  ],
};
