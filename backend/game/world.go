package game

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"
)

const (
	GridSize   = 30
	MaxPlayers = 10
)

var availableModels = []string{
	"animals/animal-bunny.glb",
	"animals/animal-caterpillar.glb",
	"animals/animal-cat.glb",
	"animals/animal-chick.glb",
	"animals/animal-cow.glb",
	"animals/animal-dog.glb",
	"animals/animal-elephant.glb",
	"animals/animal-fish.glb",
	"animals/animal-giraffe.glb",
	"animals/animal-hog.glb",
	"animals/animal-lion.glb",
	"animals/animal-monkey.glb",
	"animals/animal-parrot.glb",
	"animals/animal-pig.glb",
	"animals/animal-tiger.glb",
}

type EnqueueCommandResultCode string

const (
	EnqueueCommandResultQueued         EnqueueCommandResultCode = "queued"
	EnqueueCommandResultInvalidCommand EnqueueCommandResultCode = "invalid_command"
	EnqueueCommandResultQueueFull      EnqueueCommandResultCode = "queue_full"
	EnqueueCommandResultUnitNotFound   EnqueueCommandResultCode = "unit_not_found"
)

type EnqueueCommandResult struct {
	Accepted    bool
	Code        EnqueueCommandResultCode
	QueueLength int
	QueueLimit  int
}

type World struct {
	mu            sync.RWMutex
	Grid          [GridSize][GridSize]*Unit
	Units         map[string]*Unit
	Tick          int64
	rng           *rand.Rand
	LastActions   []ActionEvent
}

type ActionEvent struct {
	UnitID string
	Action string
	X      int
	Y      int
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
			// Select model with minimal duplication
			model := w.selectLeastUsedModel()
			unit := NewUnit(id, name, model, x, y)
			w.Units[id] = unit
			w.Grid[x][y] = unit
			log.Printf("Unit %s spawned with model %s at (%d, %d)\n", name, model, x, y)
			return unit, nil
		}
		attempts++
	}

	return nil, fmt.Errorf("no empty cells")
}

func (w *World) selectLeastUsedModel() string {
	// Count model usage
	modelCounts := make(map[string]int)
	for _, model := range availableModels {
		modelCounts[model] = 0
	}

	for _, unit := range w.Units {
		modelCounts[unit.Model]++
	}

	// Find models with minimum usage
	minCount := len(w.Units) + 1
	var leastUsed []string

	for _, model := range availableModels {
		count := modelCounts[model]
		if count < minCount {
			minCount = count
			leastUsed = []string{model}
		} else if count == minCount {
			leastUsed = append(leastUsed, model)
		}
	}

	// Randomly select from least used models
	if len(leastUsed) > 0 {
		return leastUsed[w.rng.Intn(len(leastUsed))]
	}

	// Fallback to random model
	return availableModels[w.rng.Intn(len(availableModels))]
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
	w.LastActions = []ActionEvent{} // Clear previous actions

	// Phase 1: Process move commands (highest priority)
	moveIntents := make(map[string][2]int) // unit_id -> [newX, newY]
	cellTargets := make(map[[2]int][]string) // [x,y] -> []unit_ids trying to move there
	moveCommands := make(map[string]string) // unit_id -> command

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
		moveCommands[id] = cmd
		key := [2]int{newX, newY}
		cellTargets[key] = append(cellTargets[key], id)
	}

	// Resolve move collisions
	for id, target := range moveIntents {
		unit := w.Units[id]
		cmd := moveCommands[id]
		newX, newY := target[0], target[1]
		key := [2]int{newX, newY}

		// Check if cell is occupied or multiple units trying to move there
		occupied := w.Grid[newX][newY] != nil
		collision := len(cellTargets[key]) > 1

		if occupied || collision {
			// Move fails, consume qi
			unit.Qi--
			unit.ActionQueue = unit.ActionQueue[1:]
			log.Printf("Unit %s move failed (occupied=%v, collision=%v)\n", unit.Name, occupied, collision)
		} else {
			// Move succeeds
			w.Grid[unit.X][unit.Y] = nil
			unit.X, unit.Y = newX, newY
			w.Grid[newX][newY] = unit
			unit.Qi--
			unit.ActionQueue = unit.ActionQueue[1:]

			// Record action event
			w.LastActions = append(w.LastActions, ActionEvent{
				UnitID: id,
				Action: cmd,
				X:      newX,
				Y:      newY,
			})
			log.Printf("Unit %s executed %s to (%d, %d)\n", unit.Name, cmd, newX, newY)
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

		// Record attack action
		w.LastActions = append(w.LastActions, ActionEvent{
			UnitID: unit.ID,
			Action: cmd,
			X:      unit.X,
			Y:      unit.Y,
		})

		if targetX < 0 || targetX >= GridSize || targetY < 0 || targetY >= GridSize {
			log.Printf("Unit %s executed %s (missed - out of bounds)\n", unit.Name, cmd)
			continue
		}

		target := w.Grid[targetX][targetY]
		if target != nil {
			target.HP -= unit.Attack
			log.Printf("Unit %s executed %s, hit %s for %d damage (HP: %d -> %d)\n",
				unit.Name, cmd, target.Name, unit.Attack, target.HP+unit.Attack, target.HP)

			if target.HP <= 0 {
				w.Grid[targetX][targetY] = nil
				delete(w.Units, target.ID)
				log.Printf("Unit %s was destroyed\n", target.Name)
			}
		} else {
			log.Printf("Unit %s executed %s (missed - no target)\n", unit.Name, cmd)
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

func (w *World) EnqueueCommandForUnit(unitID, cmd string) EnqueueCommandResult {
	w.mu.RLock()
	unit, ok := w.Units[unitID]
	w.mu.RUnlock()

	if !ok {
		return EnqueueCommandResult{
			Accepted:    false,
			Code:        EnqueueCommandResultUnitNotFound,
			QueueLength: 0,
			QueueLimit:  MaxActionQueueLength,
		}
	}

	result := unit.EnqueueCommand(cmd)
	return EnqueueCommandResult{
		Accepted:    result.Accepted,
		Code:        EnqueueCommandResultCode(result.Code),
		QueueLength: result.QueueLength,
		QueueLimit:  result.QueueLimit,
	}
}
