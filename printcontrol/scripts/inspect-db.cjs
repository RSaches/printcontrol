const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Encontrar o banco no Linux (padrao Tauri)
const dbPath = path.join(os.homedir(), '.local/share/printcontrol/printcontrol.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error(err.message);
    console.log('Conectado ao banco.');
});

db.all("SELECT id, created_at FROM jobs LIMIT 10", [], (err, rows) => {
    if (err) throw err;
    console.log('Resultados:');
    rows.forEach((row) => {
        console.log(`${row.id}: [${row.created_at}]`);
    });
    db.close();
});
