/**
 * ecosystem.config.cjs — PM2 process configuration for SKÖLL-TRACK ML Backend
 *
 * NOTE: This file MUST keep the .cjs extension.
 * The project uses "type": "module" in package.json, which causes Node.js to
 * treat .js files as ESM. PM2 reads its config as CommonJS (require-based),
 * so the .cjs extension is mandatory to bypass the ESM rule.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────────
 *   pm2 start ecosystem.config.cjs          # start
 *   pm2 restart skoll-ml                    # restart
 *   pm2 stop    skoll-ml                    # stop
 *   pm2 logs    skoll-ml                    # tail logs
 *   pm2 monit                               # live process monitor
 *   pm2 save && pm2 startup                 # persist across reboots
 *
 * ── Install prerequisites ──────────────────────────────────────────────────────
 *   npm install -g pm2
 *   npm install ws dotenv      # tfjs is already in package.json dependencies
 */

'use strict';

module.exports = {
  apps: [
    {
      // ── Identity ──────────────────────────────────────────────────────────
      name:        'skoll-ml',
      script:      './server.js',
      cwd:         __dirname,

      // ── Process model ─────────────────────────────────────────────────────
      // ESM + top-level await requires 'fork' mode — do NOT use 'cluster'.
      instances:   1,
      exec_mode:   'fork',

      // ── Tell PM2 the script is ESM so PM2 does not wrap it in require() ──
      // (PM2 >= 5.3.0 supports this flag)
      // interpreter_args: '--input-type=module',  // only needed if PM2 < 5.3

      // ── Auto-restart policy ───────────────────────────────────────────────
      autorestart:   true,
      watch:         false,
      max_restarts:  10,
      restart_delay: 4000,       // ms between restart attempts
      min_uptime:    '10s',      // must stay alive ≥10 s to count as started

      // ── Memory guard ─────────────────────────────────────────────────────
      // @tensorflow/tfjs CPU backend is pure JS — peak ~300–500 MB for LSTM v1
      max_memory_restart: '800M',

      // ── Node.js flags ────────────────────────────────────────────────────
      // Limit V8 heap; tfjs manages its own typed-array memory separately
      node_args: '--max-old-space-size=512',

      // ── Production environment ───────────────────────────────────────────
      env: {
        NODE_ENV:           'production',
        PORT:               '8080',
        MODEL_PATH:         './public/models/skoll-lstm-v1/model.json',
        FETCH_INTERVAL_MS:  '60000',   // NOAA poll: every 60 s
        LOG_LEVEL:          'info',
      },

      // ── Development override  (pm2 start ecosystem.config.cjs --env dev) ─
      env_dev: {
        NODE_ENV:           'development',
        PORT:               '8081',
        FETCH_INTERVAL_MS:  '15000',
        LOG_LEVEL:          'debug',
      },

      // ── Logging ──────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file:        './logs/skoll-ml-out.log',
      error_file:      './logs/skoll-ml-error.log',
      merge_logs:      true,
    },
  ],
};
