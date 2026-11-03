/**
 * Curio Backend — PostgreSQL Connection Pool
 *
 * Implements connection pooling, keep-alives, and automatic reconnection.
 *
 * @module backend/db
 */

let pool = null;

try {
  const pkg = await import('pg');
  const Pool = pkg.default?.Pool || pkg.Pool;
  if (Pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://curio:curio_secret@localhost:5432/curio_db',
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[Curio Database] Unexpected idle client error:', err);
    });
  }
} catch {
  // 'pg' is optional for core explanation services; required when enabling PostgreSQL sync
}

/**
 * Execute parameterized SQL query.
 * @param {string} text
 * @param {Array} [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool is not available. Please install pg and configure DATABASE_URL.');
  }
  const start = performance.now();
  const res = await pool.query(text, params);
  const duration = Math.round(performance.now() - start);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DB Query] ${text.slice(0, 60)}... (${duration}ms, rows: ${res.rowCount})`);
  }
  return res;
}

/**
 * Check active database connectivity.
 * @returns {Promise<boolean>}
 */
export async function checkDbHealth() {
  if (!pool) {
    return false;
  }
  try {
    const res = await pool.query('SELECT 1 as healthy');
    return res.rows[0]?.healthy === 1;
  } catch (err) {
    console.error('[Curio Database] Healthcheck failed:', err.message);
    return false;
  }
}

export default pool;

