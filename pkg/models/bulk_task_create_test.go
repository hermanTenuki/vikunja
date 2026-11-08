// Vikunja is a to-do list application to facilitate your life.
// Copyright 2018-present Vikunja and contributors. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package models

import (
	"context"
	"reflect"
	"strconv"
	"testing"

	"code.vikunja.io/api/pkg/db"
	"code.vikunja.io/api/pkg/events"
	"code.vikunja.io/api/pkg/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"
)

// positionsForTasks returns taskID → position for one view.
func positionsForTasks(t *testing.T, s *xorm.Session, viewID int64, taskIDs []int64) map[int64]float64 {
	t.Helper()
	positions := []*TaskPosition{}
	err := s.Where("project_view_id = ?", viewID).In("task_id", taskIDs).Find(&positions)
	require.NoError(t, err)
	result := make(map[int64]float64, len(positions))
	for _, p := range positions {
		result[p.TaskID] = p.Position
	}
	return result
}

func TestBulkTaskCreation_Create(t *testing.T) {
	usr := &user.User{ID: 1}

	t.Run("happy path", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks: []*Task{
				{Title: "bulk one"},
				{Title: "bulk two"},
				{Title: "bulk three"},
			},
		}
		err := btc.Create(s, usr)
		require.NoError(t, err)
		require.NoError(t, s.Commit())

		taskIDs := make([]int64, 0, len(btc.Tasks))
		for i, task := range btc.Tasks {
			assert.NotZero(t, task.ID)
			assert.NotEmpty(t, task.UID)
			assert.NotEmpty(t, task.Identifier)
			// Project 1's highest index is 34, held by the soft-deleted task 51.
			assert.Equal(t, int64(35+i), task.Index)
			taskIDs = append(taskIDs, task.ID)
		}

		for _, task := range btc.Tasks {
			db.AssertExists(t, "tasks", map[string]interface{}{
				"id":            task.ID,
				"title":         task.Title,
				"project_id":    1,
				"created_by_id": 1,
			}, false)
		}

		// The kanban view 4 puts new tasks into its default bucket 1.
		for _, task := range btc.Tasks {
			db.AssertExists(t, "task_buckets", map[string]interface{}{
				"task_id":   task.ID,
				"bucket_id": 1,
			}, false)
		}

		// Distinct positions in payload order in every view of project 1.
		for _, viewID := range []int64{1, 2, 3, 4} {
			positions := positionsForTasks(t, s, viewID, taskIDs)
			require.Len(t, positions, len(taskIDs), "view %d", viewID)
			assert.Less(t, positions[taskIDs[0]], positions[taskIDs[1]], "view %d", viewID)
			assert.Less(t, positions[taskIDs[1]], positions[taskIDs[2]], "view %d", viewID)
		}

		events.DispatchPending(context.Background(), s)
		events.AssertDispatched(t, &TaskCreatedEvent{})
		events.AssertDispatched(t, &TasksBatchCreatedEvent{})
	})

	t.Run("batch lands at the bottom of a view with existing positions", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		highest := &TaskPosition{}
		exists, err := s.Where("project_view_id = ?", 1).OrderBy("position desc").Get(highest)
		require.NoError(t, err)
		require.True(t, exists)

		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks:     []*Task{{Title: "bottom one"}, {Title: "bottom two"}},
		}
		require.NoError(t, btc.Create(s, usr))
		require.NoError(t, s.Commit())

		positions := positionsForTasks(t, s, 1, []int64{btc.Tasks[0].ID, btc.Tasks[1].ID})
		assert.Greater(t, positions[btc.Tasks[0].ID], highest.Position)
		assert.Greater(t, positions[btc.Tasks[1].ID], positions[btc.Tasks[0].ID])
	})

	t.Run("task flipped to done gets a single position", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		// Bucket 3 is view 4's done bucket, so the task gets a position there before the batch positions are calculated.
		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks:     []*Task{{Title: "into done bucket", BucketID: 3}},
		}
		require.NoError(t, btc.Create(s, usr))
		require.NoError(t, s.Commit())

		assert.True(t, btc.Tasks[0].Done)

		count, err := s.Where("project_view_id = ? AND task_id = ?", 4, btc.Tasks[0].ID).Count(&TaskPosition{})
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("explicit bucket", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		bucket := &Bucket{Title: "bulk target", ProjectViewID: 4, CreatedByID: 1}
		_, err := s.Insert(bucket)
		require.NoError(t, err)

		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks:     []*Task{{Title: "into bucket", BucketID: bucket.ID}},
		}
		require.NoError(t, btc.Create(s, usr))
		require.NoError(t, s.Commit())

		db.AssertExists(t, "task_buckets", map[string]interface{}{
			"task_id":   btc.Tasks[0].ID,
			"bucket_id": bucket.ID,
		}, false)
	})

	t.Run("bucket limit reached mid-batch fails the whole batch", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		bucket := &Bucket{Title: "tiny", ProjectViewID: 4, CreatedByID: 1, Limit: 1}
		_, err := s.Insert(bucket)
		require.NoError(t, err)

		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks: []*Task{
				{Title: "fits", BucketID: bucket.ID},
				{Title: "does not fit", BucketID: bucket.ID},
			},
		}
		err = btc.Create(s, usr)
		require.Error(t, err)
		require.True(t, IsErrInvalidTaskInBulkCreation(err))
		assert.Equal(t, 1, err.(ErrInvalidTaskInBulkCreation).Index)
		var limitErr ErrBucketLimitExceeded
		require.ErrorAs(t, err, &limitErr)
		assert.Equal(t, bucket.ID, limitErr.BucketID)
		assert.Equal(t, btc.Tasks[1].ID, limitErr.TaskID)
	})

	t.Run("bucket already full", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		// Bucket 2 has limit 3 and already holds 3 tasks.
		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks:     []*Task{{Title: "overflow", BucketID: 2}},
		}
		err := btc.Create(s, usr)
		require.Error(t, err)
		require.True(t, IsErrInvalidTaskInBulkCreation(err))
		assert.Equal(t, 0, err.(ErrInvalidTaskInBulkCreation).Index)
		var limitErr ErrBucketLimitExceeded
		require.ErrorAs(t, err, &limitErr)
		assert.Equal(t, int64(2), limitErr.BucketID)
	})

	t.Run("empty batch", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		btc := &BulkTaskCreation{ProjectID: 1, Tasks: []*Task{}}
		err := btc.Create(s, usr)
		require.Error(t, err)
		assert.True(t, IsErrInvalidBulkTaskCreationCount(err))
	})

	t.Run("oversized batch", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		tasks := make([]*Task, MaxTasksPerBulkCreation+1)
		for i := range tasks {
			tasks[i] = &Task{Title: "too many"}
		}
		btc := &BulkTaskCreation{ProjectID: 1, Tasks: tasks}
		err := btc.Create(s, usr)
		require.Error(t, err)
		assert.True(t, IsErrInvalidBulkTaskCreationCount(err))
	})

	t.Run("invalid task carries its index", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		btc := &BulkTaskCreation{
			ProjectID: 1,
			Tasks:     []*Task{{Title: "valid"}, {Title: ""}},
		}
		err := btc.Create(s, usr)
		require.Error(t, err)
		require.True(t, IsErrInvalidTaskInBulkCreation(err))
		assert.Equal(t, 1, err.(ErrInvalidTaskInBulkCreation).Index)
		require.NoError(t, s.Rollback())

		db.AssertMissing(t, "tasks", map[string]interface{}{
			"title":      "valid",
			"project_id": 1,
		})
	})

	t.Run("nonexistent project", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		btc := &BulkTaskCreation{ProjectID: 9999999, Tasks: []*Task{{Title: "nope"}}}
		err := btc.Create(s, usr)
		require.Error(t, err)
		assert.True(t, IsErrProjectDoesNotExist(err))
	})
}

// The struct tags cannot reference the constant, so pin them here.
func TestBulkTaskCreation_TaskLimitTag(t *testing.T) {
	field, has := reflect.TypeOf(BulkTaskCreation{}).FieldByName("Tasks")
	require.True(t, has)

	maxItems, err := strconv.Atoi(field.Tag.Get("maxItems"))
	require.NoError(t, err)
	assert.Equal(t, MaxTasksPerBulkCreation, maxItems)

	minItems, err := strconv.Atoi(field.Tag.Get("minItems"))
	require.NoError(t, err)
	assert.Equal(t, 1, minItems)
}

func TestBulkTaskCreation_CanCreate(t *testing.T) {
	t.Run("write access", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		btc := &BulkTaskCreation{ProjectID: 1}
		can, err := btc.CanCreate(s, &user.User{ID: 1})
		require.NoError(t, err)
		assert.True(t, can)
	})

	t.Run("read-only access", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		// User 2 has read-only access to project 3.
		btc := &BulkTaskCreation{ProjectID: 3}
		can, err := btc.CanCreate(s, &user.User{ID: 2})
		require.NoError(t, err)
		assert.False(t, can)
	})

	t.Run("no access", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		btc := &BulkTaskCreation{ProjectID: 1}
		can, err := btc.CanCreate(s, &user.User{ID: 6})
		require.NoError(t, err)
		assert.False(t, can)
	})
}
