package game

import "sync"

const MaxActionQueueLength = 10

type EnqueueResultCode string

const (
	EnqueueResultQueued         EnqueueResultCode = "queued"
	EnqueueResultInvalidCommand EnqueueResultCode = "invalid_command"
	EnqueueResultQueueFull      EnqueueResultCode = "queue_full"
)

type EnqueueResult struct {
	Accepted    bool
	Code        EnqueueResultCode
	QueueLength int
	QueueLimit  int
}

type Unit struct {
	ID          string
	Name        string
	Model       string
	X           int
	Y           int
	HP          int
	Qi          int
	Attack      int
	ActionQueue []string
	mu          sync.Mutex
}

func NewUnit(id, name, model string, x, y int) *Unit {
	return &Unit{
		ID:          id,
		Name:        name,
		Model:       model,
		X:           x,
		Y:           y,
		HP:          10,
		Qi:          10,
		Attack:      1,
		ActionQueue: []string{},
	}
}

func (u *Unit) EnqueueCommand(cmd string) EnqueueResult {
	// Validate command
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
