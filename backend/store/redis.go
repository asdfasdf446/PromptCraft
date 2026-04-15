package store

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"promptcraft/backend/game"
)

const ttl = time.Hour

func NewClient(addr string) *redis.Client {
	return redis.NewClient(&redis.Options{Addr: addr})
}

func unitStateKey(unitID string) string {
	return fmt.Sprintf("pc:unit:%s:state", unitID)
}

func unitQueueKey(unitID string) string {
	return fmt.Sprintf("pc:unit:%s:queue", unitID)
}

func WriteUnit(rdb *redis.Client, unit *game.Unit, uid, role string) error {
	ctx := context.Background()
	key := unitStateKey(unit.ID)
	 err := rdb.HSet(ctx, key, map[string]interface{}{
		"hp":          unit.HP,
		"qi":          unit.Qi,
		"grid_x":      unit.GridX,
		"grid_y":      unit.GridY,
		"stack_level": unit.StackLevel,
		"kind":        unit.Kind,
		"model":       unit.Model,
		"name":        unit.Name,
		"uid":         uid,
		"role":        role,
	}).Err()
	if err != nil {
		return err
	}
	rdb.Expire(ctx, key, ttl)
	rdb.SAdd(ctx, "pc:world:units", unit.ID)
	return nil
}

func DeleteUnit(rdb *redis.Client, unitID string) {
	ctx := context.Background()
	rdb.Del(ctx, unitStateKey(unitID), unitQueueKey(unitID))
	rdb.SRem(ctx, "pc:world:units", unitID)
}
