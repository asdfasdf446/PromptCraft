package game

import "sync"

type Unit struct {
	ID          string
	Name        string
	X           int
	Y           int
	HP          int
	Qi          int
	Attack      int
	ActionQueue []string
	mu          sync.Mutex
}

func NewUnit(id, name string, x, y int) *Unit {
	return &Unit{
		ID:          id,
		Name:        name,
		X:           x,
		Y:           y,
		HP:          10,
		Qi:          10,
		Attack:      1,
		ActionQueue: []string{},
	}
}

func (u *Unit) EnqueueCommand(cmd string) bool {
	// Validate command
	validCommands := map[string]bool{
		"move_up": true, "move_down": true, "move_left": true, "move_right": true,
		"attack_up": true, "attack_down": true, "attack_left": true, "attack_right": true,
	}

	if !validCommands[cmd] {
		return false
	}

	u.mu.Lock()
	defer u.mu.Unlock()
	u.ActionQueue = append(u.ActionQueue, cmd)
	return true
}
