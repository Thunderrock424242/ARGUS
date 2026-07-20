-- One-time bridge for the existing ARGUS D1 database.
--
-- Migrations 0000 through 0003 were applied with `wrangler d1 execute` before
-- this repository adopted Wrangler's migration tracker. Record only those
-- already-applied files so Wrangler can safely apply 0004 and later.
CREATE TABLE IF NOT EXISTS d1_migrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT UNIQUE,
	applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
	('0000_normal_klaw.sql'),
	('0001_moaning_power_man.sql'),
	('0002_ambiguous_spot.sql'),
	('0003_solid_phil_sheldon.sql');
