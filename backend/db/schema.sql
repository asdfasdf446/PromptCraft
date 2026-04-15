CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_login    INTEGER
);

CREATE TABLE IF NOT EXISTS unit_snapshots (
    user_id      TEXT PRIMARY KEY,
    kind         TEXT NOT NULL DEFAULT 'player',
    hp           INTEGER NOT NULL DEFAULT 10,
    qi           INTEGER NOT NULL DEFAULT 10,
    attack       INTEGER NOT NULL DEFAULT 1,
    model        TEXT NOT NULL,
    grid_x       INTEGER NOT NULL DEFAULT 0,
    grid_y       INTEGER NOT NULL DEFAULT 0,
    stack_level  INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
