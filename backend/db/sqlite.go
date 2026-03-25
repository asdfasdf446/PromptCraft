package db

import (
	"database/sql"
	_ "embed"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
	"promptcraft/backend/game"
)

//go:embed schema.sql
var schema string

type User struct {
	ID           string
	Username     string
	PasswordHash string
}

func Open(path string) *sql.DB {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		panic(fmt.Sprintf("sqlite open: %v", err))
	}
	if _, err := db.Exec(schema); err != nil {
		panic(fmt.Sprintf("sqlite schema: %v", err))
	}
	return db
}

func CreateUser(db *sql.DB, username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		`INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		uuid.New().String(), username, string(hash), time.Now().Unix(),
	)
	return err
}

func GetUserByUsername(db *sql.DB, username string) (*User, error) {
	var u User
	err := db.QueryRow(
		`SELECT id, username, password_hash FROM users WHERE username = ?`, username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UpdateLastLogin(db *sql.DB, userID string) {
	db.Exec(`UPDATE users SET last_login = ? WHERE id = ?`, time.Now().Unix(), userID)
}

func UpsertSnapshot(db *sql.DB, userID string, unit *game.Unit) error {
	if unit == nil {
		return fmt.Errorf("unit is nil")
	}
	_, err := db.Exec(
		`INSERT INTO unit_snapshots (user_id, hp, qi, attack, model, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
             hp = excluded.hp, qi = excluded.qi, attack = excluded.attack,
             model = excluded.model, updated_at = excluded.updated_at`,
		userID, unit.HP, unit.Qi, unit.Attack, unit.Model, time.Now().Unix(),
	)
	return err
}
