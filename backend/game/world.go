package game

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	GridSize             = 30
	MaxPlayers           = 10
	MaxStackLevels       = 2
	ObstacleHP           = 1000
	FoodGrowthInterval   = 100
	PlayerStackYOffset   = 1
)

var availableModels = []string {
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

var foodModels = []string{
	"nature/crops_leafsStageA.glb",
	"nature/crops_leafsStageB.glb",
	"nature/crops_cornStageA.glb",
	"nature/crops_cornStageB.glb",
	"nature/crops_wheatStageA.glb",
	"nature/crops_wheatStageB.glb",
}

type EnqueueCommandResultCode string

const (
	EnqueueCommandResultQueued         EnqueueCommandResultCode = "queued"
	EnqueueCommandResultInvalidCommand EnqueueCommandResultCode = "invalid_command"
	EnqueueCommandResultQueueFull      EnqueueCommandResultCode = "queue_full"
	EnqueueCommandResultUnitNotFound   EnqueueCommandResultCode = "unit_not_found"
	EnqueueCommandResultWrongUnitKind  EnqueueCommandResultCode = "wrong_unit_kind"
)

type EnqueueCommandResult struct {
	Accepted    bool
	Code        EnqueueCommandResultCode
	QueueLength int
	QueueLimit  int
}

type Tile struct {
	Kind             TileKind
	NextFoodSpawnTick int64
}

type ActionEvent struct {
	UnitID         string
	Action         string
	X              int
	Y              int
	StackLevel     int
	TargetX        int
	TargetY        int
	TargetStackLevel int
}

type DeathEvent struct {
	UnitID     string
	Kind       UnitKind
	GridX      int
	GridY      int
	StackLevel int
	Model      string
}

type World struct {
	mu          sync.RWMutex
	Tiles       [GridSize][GridSize]Tile
	Stacks      [GridSize][GridSize][MaxStackLevels]*Unit
	Units       map[string]*Unit
	Tick        int64
	rng         *rand.Rand
	LastActions []ActionEvent
	LastDeaths  []DeathEvent
}

type moveIntent struct {
	unit       *Unit
	carried    *Unit
	command    string
	targetX    int
	targetY    int
	payload    int
}

func NewWorld() *World {
	w := &World{
		Units: make(map[string]*Unit),
		rng:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
	w.initializeTiles()
	return w
}

func (w *World) initializeTiles() {
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			roll := w.rng.Intn(10)
			kind := TileKindNormal
			switch {
			case roll == 0:
				kind = TileKindObstacle
			case roll <= 2:
				kind = TileKindFertile
			}

			tile := Tile{Kind: kind, NextFoodSpawnTick: FoodGrowthInterval + int64(w.rng.Intn(3))}
			w.Tiles[x][y] = tile
			if kind == TileKindObstacle {
				bottom := NewObstacleUnit(uuid.NewString(), x, y, 0)
				top := NewObstacleUnit(uuid.NewString(), x, y, 1)
				w.placeUnit(bottom, x, y, 0)
				w.placeUnit(top, x, y, 1)
				continue
			}
			if kind == TileKindFertile && w.rng.Intn(2) == 1 {
				food := NewFoodUnit(uuid.NewString(), x, y, 0, foodModels[w.rng.Intn(len(foodModels))])
				w.placeUnit(food, x, y, 0)
			}
		}
	}
}

func (w *World) placeUnit(unit *Unit, x, y, stackLevel int) {
	unit.GridX = x
	unit.GridY = y
	unit.StackLevel = stackLevel
	w.Stacks[x][y][stackLevel] = unit
	w.Units[unit.ID] = unit
}

func (w *World) removeUnitFromStack(unit *Unit) {
	if unit == nil {
		return
	}
	if unit.GridX >= 0 && unit.GridX < GridSize && unit.GridY >= 0 && unit.GridY < GridSize && unit.StackLevel >= 0 && unit.StackLevel < MaxStackLevels {
		if w.Stacks[unit.GridX][unit.GridY][unit.StackLevel] == unit {
			w.Stacks[unit.GridX][unit.GridY][unit.StackLevel] = nil
		}
	}
}

func (w *World) getStackCount(x, y int) int {
	count := 0
	for level := 0; level < MaxStackLevels; level++ {
		if w.Stacks[x][y][level] != nil {
			count++
		}
	}
	return count
}

func (w *World) normalizeTile(x, y int) {
	if w.Stacks[x][y][0] == nil && w.Stacks[x][y][1] != nil {
		w.Stacks[x][y][0] = w.Stacks[x][y][1]
		w.Stacks[x][y][1] = nil
		w.Stacks[x][y][0].StackLevel = 0
	}
}

func (w *World) SpawnUnit(id, name string) (*Unit, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	playerCount := 0
	for _, unit := range w.Units {
		if unit.Kind == UnitKindPlayer {
			playerCount++
		}
	}
	if playerCount >= MaxPlayers {
		return nil, fmt.Errorf("world full")
	}

	attempts := 0
	for attempts < 500 {
		x := w.rng.Intn(GridSize)
		y := w.rng.Intn(GridSize)
		if w.Tiles[x][y].Kind == TileKindObstacle {
			attempts++
			continue
		}

		count := w.getStackCount(x, y)
		if count < MaxStackLevels {
			model := w.selectLeastUsedPlayerModel()
			unit := NewPlayerUnit(id, name, model, x, y, count)
			w.placeUnit(unit, x, y, count)
			log.Printf("Unit %s spawned with model %s at (%d, %d, %d)\n", name, model, x, y, count)
			return unit, nil
		}
		attempts++
	}

	return nil, fmt.Errorf("no available stack slot")
}

func (w *World) selectLeastUsedPlayerModel() string {
	modelCounts := make(map[string]int)
	for _, model := range availableModels {
		modelCounts[model] = 0
	}
	for _, unit := range w.Units {
		if unit.Kind == UnitKindPlayer {
			modelCounts[unit.Model]++
		}
	}
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
	if len(leastUsed) > 0 {
		return leastUsed[w.rng.Intn(len(leastUsed))]
	}
	return availableModels[w.rng.Intn(len(availableModels))]
}

func (w *World) RemoveUnit(id string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	unit, ok := w.Units[id]
	if !ok {
		return
	}
	w.removeUnitFromStack(unit)
	delete(w.Units, id)
	w.normalizeTile(unit.GridX, unit.GridY)
}

func (w *World) ProcessTick() {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.Tick++
	w.LastActions = []ActionEvent{}
	w.LastDeaths = []DeathEvent{}
	w.restoreObstacleHP()
	w.processMovementPhase()
	w.normalizeAllTiles()
	w.processAttackPhase()
	w.normalizeAllTiles()
	w.spawnFoodOnFertileTiles()
}

func (w *World) restoreObstacleHP() {
	for _, unit := range w.Units {
		if unit.Kind == UnitKindObstacle {
			unit.HP = ObstacleHP
		}
	}
}

func (w *World) processMovementPhase() {
	moveIntents := make(map[string]moveIntent)
	cellTargets := make(map[[2]int][]string)

	for id, unit := range w.Units {
		if !unit.CanMove() || len(unit.ActionQueue) == 0 {
			continue
		}
		if unit.StackLevel == 1 {
			below := w.Stacks[unit.GridX][unit.GridY][0]
			if below == nil || below.Kind != UnitKindFood {
				continue
			}
		} else if unit.StackLevel != 0 {
			continue
		}
		cmd := unit.ActionQueue[0]
		if !isMoveCommand(cmd) || unit.Qi < 1 {
			continue
		}
		targetX, targetY := unit.GridX, unit.GridY
		switch cmd {
		case "move_up":
			targetY--
		case "move_down":
			targetY++
		case "move_left":
			targetX--
		case "move_right":
			targetX++
		}
		if targetX < 0 || targetX >= GridSize || targetY < 0 || targetY >= GridSize {
			unit.ActionQueue = unit.ActionQueue[1:]
			continue
		}
		carried := w.Stacks[unit.GridX][unit.GridY][1]
		payload := 1
		if carried != nil && carried != unit {
			payload = 2
		}
		moveIntents[id] = moveIntent{unit: unit, carried: carried, command: cmd, targetX: targetX, targetY: targetY, payload: payload}
		cellTargets[[2]int{targetX, targetY}] = append(cellTargets[[2]int{targetX, targetY}], id)
	}

	for id, intent := range moveIntents {
		collision := len(cellTargets[[2]int{intent.targetX, intent.targetY}]) > 1
		destinationCount := w.getStackCount(intent.targetX, intent.targetY)
		obstacleTile := w.Tiles[intent.targetX][intent.targetY].Kind == TileKindObstacle
		if collision || obstacleTile || destinationCount+intent.payload > MaxStackLevels {
			intent.unit.Qi--
			intent.unit.ActionQueue = intent.unit.ActionQueue[1:]
			log.Printf("Unit %s move failed (collision=%v obstacleTile=%v destinationCount=%d payload=%d)\n", intent.unit.Name, collision, obstacleTile, destinationCount, intent.payload)
			continue
		}

		originX, originY := intent.unit.GridX, intent.unit.GridY
		originLevel := intent.unit.StackLevel
		w.Stacks[originX][originY][originLevel] = nil
		if intent.carried != nil && intent.carried != intent.unit {
			w.Stacks[originX][originY][1] = nil
		}

		if destinationCount == 0 {
			w.placeUnit(intent.unit, intent.targetX, intent.targetY, 0)
			if intent.carried != nil && intent.carried != intent.unit {
				w.placeUnit(intent.carried, intent.targetX, intent.targetY, 1)
			}
		} else {
			w.placeUnit(intent.unit, intent.targetX, intent.targetY, 1)
		}

		intent.unit.Qi--
		intent.unit.ActionQueue = intent.unit.ActionQueue[1:]
		w.LastActions = append(w.LastActions, ActionEvent{UnitID: id, Action: intent.command, X: originX, Y: originY, StackLevel: originLevel, TargetX: intent.targetX, TargetY: intent.targetY, TargetStackLevel: intent.unit.StackLevel})
		if intent.carried != nil && intent.carried != intent.unit {
			w.LastActions = append(w.LastActions, ActionEvent{UnitID: intent.carried.ID, Action: "carried_" + intent.command, X: originX, Y: originY, StackLevel: 1, TargetX: intent.targetX, TargetY: intent.targetY, TargetStackLevel: intent.carried.StackLevel})
		}
	}
}

func (w *World) processAttackPhase() {
	for _, unit := range w.Units {
		if !unit.CanAttack() || len(unit.ActionQueue) == 0 {
			continue
		}
		cmd := unit.ActionQueue[0]
		if !isAttackCommand(cmd) || unit.Qi < 2 {
			continue
		}
		targetX, targetY := unit.GridX, unit.GridY
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
		unit.Qi -= 2
		unit.ActionQueue = unit.ActionQueue[1:]
		targetLevel := 0
		if targetX < 0 || targetX >= GridSize || targetY < 0 || targetY >= GridSize {
			w.LastActions = append(w.LastActions, ActionEvent{UnitID: unit.ID, Action: cmd, X: unit.GridX, Y: unit.GridY, StackLevel: unit.StackLevel, TargetX: targetX, TargetY: targetY, TargetStackLevel: targetLevel})
			continue
		}
		target := w.Stacks[targetX][targetY][1]
		targetLevel = 1
		if target == nil {
			target = w.Stacks[targetX][targetY][0]
			targetLevel = 0
		}
		w.LastActions = append(w.LastActions, ActionEvent{UnitID: unit.ID, Action: cmd, X: unit.GridX, Y: unit.GridY, StackLevel: unit.StackLevel, TargetX: targetX, TargetY: targetY, TargetStackLevel: targetLevel})
		if target == nil {
			continue
		}
		target.HP -= unit.Attack
		if target.HP <= 0 {
			w.LastDeaths = append(w.LastDeaths, DeathEvent{UnitID: target.ID, Kind: target.Kind, GridX: target.GridX, GridY: target.GridY, StackLevel: target.StackLevel, Model: target.Model})
			w.removeUnitFromStack(target)
			delete(w.Units, target.ID)
			w.normalizeTile(targetX, targetY)
		}
	}
}

func (w *World) spawnFoodOnFertileTiles() {
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			tile := &w.Tiles[x][y]
			if tile.Kind != TileKindFertile || w.Tick < tile.NextFoodSpawnTick {
				continue
			}
			count := w.getStackCount(x, y)
			if count < MaxStackLevels {
				food := NewFoodUnit(uuid.NewString(), x, y, count, foodModels[w.rng.Intn(len(foodModels))])
				w.placeUnit(food, x, y, count)
			}
			tile.NextFoodSpawnTick = w.Tick + FoodGrowthInterval + int64(w.rng.Intn(3))
		}
	}
}

func (w *World) normalizeAllTiles() {
	for x := 0; x < GridSize; x++ {
		for y := 0; y < GridSize; y++ {
			w.normalizeTile(x, y)
		}
	}
}

func (w *World) RegenerateQi() {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, unit := range w.Units {
		if unit.Kind == UnitKindPlayer && unit.Qi < 10 {
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
		return EnqueueCommandResult{Accepted: false, Code: EnqueueCommandResultUnitNotFound, QueueLength: 0, QueueLimit: MaxActionQueueLength}
	}
	result := unit.EnqueueCommand(cmd)
	return EnqueueCommandResult{Accepted: result.Accepted, Code: EnqueueCommandResultCode(result.Code), QueueLength: result.QueueLength, QueueLimit: result.QueueLimit}
}
