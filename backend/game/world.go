package game

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

const (
	GridSize   = 30
	MaxPlayers = 10
)

type World struct {
	mu       sync.RWMutex
	Grid     [GridSize][GridSize]*Unit
	Units    map[string]*Unit
	Tick     int64
	rng      *rand.Rand
}

func NewWorld() *World {
	return &World{
		Units: make(map[string]*Unit),
		rng:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (w *World) SpawnUnit(id, name string) (*Unit, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if len(w.Units) >= MaxPlayers {
		return nil, fmt.Errorf("world full")
	}

	// Find random empty cell
	attempts := 0
	for attempts < 100 {
		x := w.rng.Intn(GridSize)
		y := w.rng.Intn(GridSize)
		if w.Grid[x][y] == nil {
			unit := NewUnit(id, name, x, y)
			w.Units[id] = unit
			w.Grid[x][y] = unit
			return unit, nil
		}
		attempts++
	}

	return nil, fmt.Errorf("no empty cells")
}

func (w *World) RemoveUnit(id string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if unit, ok := w.Units[id]; ok {
		w.Grid[unit.X][unit.Y] = nil
		delete(w.Units, id)
	}
}

func (w *World) ProcessTick() {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.Tick++

	// Phase 1: Process move commands (highest priority)
	moveIntents := make(map[string][2]int) // unit_id -> [newX, newY]
	cellTargets := make(map[[2]int][]string) // [x,y] -> []unit_ids trying to move there

	for id, unit := range w.Units {
		if len(unit.ActionQueue) == 0 {
			continue
		}

		cmd := unit.ActionQueue[0]
		if !isMoveCommand(cmd) {
			continue
		}

		if unit.Qi < 1 {
			continue
		}

		newX, newY := unit.X, unit.Y
		switch cmd {
		case "move_up":
			newY--
		case "move_down":
			newY++
		case "move_left":
			newX--
		case "move_right":
			newX++
		}

		if newX < 0 || newX >= GridSize || newY < 0 || newY >= GridSize {
			unit.ActionQueue = unit.ActionQueue[1:]
			continue
		}

		moveIntents[id] = [2]int{newX, newY}
		key := [2]int{newX, newY}
		cellTargets[key] = append(cellTargets[key], id)
	}

	// Resolve move collisions
	for id, target := range moveIntents {
		unit := w.Units[id]
		newX, newY := target[0], target[1]
		key := [2]int{newX, newY}

		// Check if cell is occupied or multiple units trying to move there
		occupied := w.Grid[newX][newY] != nil
		collision := len(cellTargets[key]) > 1

		if occupied || collision {
			// Move fails, consume qi
			unit.Qi--
			unit.ActionQueue = unit.ActionQueue[1:]
		} else {
			// Move succeeds
			w.Grid[unit.X][unit.Y] = nil
			unit.X, unit.Y = newX, newY
			w.Grid[newX][newY] = unit
			unit.Qi--
			unit.ActionQueue = unit.ActionQueue[1:]
		}
	}

	// Phase 2: Process attack commands (lowest priority)
	for _, unit := range w.Units {
		if len(unit.ActionQueue) == 0 {
			continue
		}

		cmd := unit.ActionQueue[0]
		if !isAttackCommand(cmd) {
			continue
		}

		if unit.Qi < 2 {
			continue
		}

		targetX, targetY := unit.X, unit.Y
		switch cmd {
		case "attack_up":
			targetY--
		case "attack_down":
			targetY++
		case "attack_left":
			targetX--
		case "attack_right":
			targetX++
		}

		// Consume qi regardless
		unit.Qi -= 2
		unit.ActionQueue = unit.ActionQueue[1:]

		if targetX < 0 || targetX >= GridSize || targetY < 0 || targetY >= GridSize {
			continue
		}

		target := w.Grid[targetX][targetY]
		if target != nil {
			target.HP -= unit.Attack
			if target.HP <= 0 {
				w.Grid[targetX][targetY] = nil
				delete(w.Units, target.ID)
			}
		}
	}
}

func (w *World) RegenerateQi() {
	w.mu.Lock()
	defer w.mu.Unlock()

	for _, unit := range w.Units {
		if unit.Qi < 10 {
			unit.Qi++
		}
	}
}

func isMoveCommand(cmd string) bool {
	return cmd == "move_up" || cmd == "move_down" || cmd == "move_left" || cmd == "move_right"
}

func isAttackCommand(cmd string) bool {
	return cmd == "attack_up" || cmd == "attack_down" || cmd == "attack_left" || cmd == "attack_right"
}

func (w *World) EnqueueCommandForUnit(unitID, cmd string) bool {
	w.mu.RLock()
	unit, ok := w.Units[unitID]
	w.mu.RUnlock()

	if !ok {
		return false
	}

	return unit.EnqueueCommand(cmd)
}
