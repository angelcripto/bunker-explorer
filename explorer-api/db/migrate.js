const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');

    try {
        await pool.query(sql);
        console.log('[DB] Schema migration completed');
    } catch (err) {
        console.error('[DB] Migration failed:', err.message);
        throw err;
    }
}

module.exports = { migrate };
