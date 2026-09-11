// CRM Data Layer - Re-exporting from secure SQLite Database
// All clients, credentials, passwords, and work logs are stored strictly in the database.
import { sqliteDb } from './sqlite_db.js';

export const db = sqliteDb;
export default sqliteDb;
