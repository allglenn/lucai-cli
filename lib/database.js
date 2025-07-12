const path = require('path');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const { ensureConfigDirExists } = require('./config');

const dbPath = path.join(os.homedir(), '.lucai', 'log.db');

// Ensure the directory exists before trying to open the database
ensureConfigDirExists();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    // Create the reviews table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        path TEXT NOT NULL,
        score INTEGER NOT NULL,
        commit_hash TEXT
      )
    `);
  }
});

/**
 * Adds a new review score to the database.
 * @param {object} reviewData - The data for the review.
 * @param {string} reviewData.path - The path that was reviewed.
 * @param {number} reviewData.score - The quality score (0-100).
 * @param {string} [reviewData.commit_hash] - The git commit hash (optional).
 */
function addReview(reviewData) {
  return new Promise((resolve, reject) => {
    const { path, score, commit_hash } = reviewData;
    const sql = `INSERT INTO reviews (path, score, commit_hash) VALUES (?, ?, ?)`;

    db.run(sql, [path, score, commit_hash], function (err) {
      if (err) {
        console.error('Error saving review to database', err.message);
        return reject(err);
      }
      resolve({ id: this.lastID });
    });
  });
}

/**
 * Retrieves the review history.
 * @param {number} [limit=20] - The number of recent reviews to fetch.
 * @returns {Promise<Array<object>>} A promise that resolves to the review history.
 */
function getHistory(limit = 20) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM reviews ORDER BY timestamp DESC LIMIT ?`;
    db.all(sql, [limit], (err, rows) => {
      if (err) {
        console.error('Error fetching history from database', err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

module.exports = {
  addReview,
  getHistory,
}; 