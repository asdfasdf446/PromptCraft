package game

import "sync"

const MaxActionQueueLength = 10

type UnitKind string

type TileKind string

const (
	UnitKindPlayer   UnitKind = "player"
	UnitKindFood     UnitKind = "food"
	UnitKindObstacle UnitKind = "obstacle"
)

const (
	TileKindNormal   TileKind = "normal"
	TileKindFertile  TileKind = "fertile"
	TileKindObstacle TileKind = "obstacle"
)

type EnqueueResultCode string

const (
	EnqueueResultQueued         EnqueueResultCode = "queued"
	EnqueueResultInvalidCommand EnqueueResultCode = "invalid_command"
	EnqueueResultQueueFull      EnqueueResultCode = "queue_full"
	EnqueueResultWrongUnitKind  EnqueueResultCode = "wrong_unit_kind"
)

type EnqueueResult struct {
	Accepted    bool
	Code        EnqueueResultCode
	QueueLength int
	QueueLimit  int
}

type Unit struct {
	ID          string
	Kind        UnitKind
	Name        string
	Model       string
	GridX       int
	GridY       int
	StackLevel  int
	HP          int
	Qi          int
	Attack      int
	ActionQueue []string
	mu          sync.Mutex
}

func NewPlayerUnit(id, name, model string, gridX, gridY, stackLevel int) *Unit {
	return &Unit{
		ID:          id,
		Kind:        UnitKindPlayer,
		Name:        name,
		Model:       model,
		GridX:       gridX,
		GridY:       gridY,
		StackLevel:  stackLevel,
		HP:          10,
		Qi:          10,
		Attack:      1,
		ActionQueue: []string{},
	}
}

func NewFoodUnit(id string, gridX, gridY, stackLevel int, model string) *Unit {
	return &Unit{
		ID:         id,
		Kind:       UnitKindFood,
		Name:       "Food",
		Model:      model,
		GridX:      gridX,
		GridY:      gridY,
		StackLevel: stackLevel,
		HP:         3,
		Attack:     0,
	}
}

func NewObstacleUnit(id string, gridX, gridY, stackLevel int) *Unit {
	return &Unit{
		ID:         id,
		Kind:       UnitKindObstacle,
		Name:       "Obstacle",
		Model:      "",
		GridX:      gridX,
		GridY:      gridY,
		StackLevel: stackLevel,
		HP:         1000,
		Attack:     0,
	}
}

func (u *Unit) CanReceiveCommands() bool {
	return u.Kind == UnitKindPlayer
}

func (u *Unit) CanMove() bool {
	return u.Kind == UnitKindPlayer
}

func (u *Unit) CanAttack() bool {
	return u.Kind == UnitKindPlayer
}

func (u *Unit) EnqueueCommand(cmd string) EnqueueResult {
	if !u.CanReceiveCommands() {
		return EnqueueResult{
			Accepted:    false,
			Code:        EnqueueResultWrongUnitKind,
			QueueLength: len(u.ActionQueue),
			QueueLimit:  MaxActionQueueLength,
		}
	}

	validCommands := map[string]bool{
		"move_up": true, "move_down": true, "move_left": true, "move_right": true,
		"attack_up": true, "attack_down": true, "attack_left": true, "attack_right": true,
	}

	if !validCommands[cmd] {
		return EnqueueResult{
			Accepted:    false,
			Code:        EnqueueResultInvalidCommand,
			QueueLength: len(u.ActionQueue),
			QueueLimit:  MaxActionQueueLength,
		}
	}

	u.mu.Lock()
	defer u.mu.Unlock()

	if len(u.ActionQueue) >= MaxActionQueueLength {
		return EnqueueResult{
			Accepted:    false,
			Code:        EnqueueResultQueueFull,
			QueueLength: len(u.ActionQueue),
			QueueLimit:  MaxActionQueueLength,
		}
	}

	u.ActionQueue = append(u.ActionQueue, cmd)
	return EnqueueResult{
		Accepted:    true,
		Code:        EnqueueResultQueued,
		QueueLength: len(u.ActionQueue),
		QueueLimit:  MaxActionQueueLength,
	}
}
