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

package migration

import (
	"slices"
	"testing"
	"time"

	"code.vikunja.io/api/pkg/db"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"src.techknowlogick.com/xormigrate"
	"xorm.io/xorm"
	"xorm.io/xorm/schemas"
)

type taskBucketBefore20261107170233 struct {
	BucketID      int64 `xorm:"bigint not null index"`
	TaskID        int64 `xorm:"bigint not null index unique(task_view)"`
	ProjectViewID int64 `xorm:"bigint not null index unique(task_view)"`
}

func (taskBucketBefore20261107170233) TableName() string { return "task_buckets" }

type taskBucketAfter20261107170233 struct {
	BucketID      int64      `xorm:"bigint not null index"`
	TaskID        int64      `xorm:"bigint not null index unique(task_view)"`
	ProjectViewID int64      `xorm:"bigint not null index unique(task_view)"`
	EnteredAt     *time.Time `xorm:"null 'entered_at'"`
}

func (taskBucketAfter20261107170233) TableName() string { return "task_buckets" }

type task20261107170233 struct {
	ID     int64      `xorm:"bigint autoincr not null unique pk"`
	DoneAt *time.Time `xorm:"DATETIME null 'done_at'"`
	// Not xorm:"created", so the test controls the value.
	Created time.Time `xorm:"DATETIME not null 'created'"`
}

func (task20261107170233) TableName() string { return "tasks" }

type projectView20261107170233 struct {
	ID           int64 `xorm:"bigint autoincr not null unique pk"`
	DoneBucketID int64 `xorm:"bigint null"`
}

func (projectView20261107170233) TableName() string { return "project_views" }

func runMigration20261107170233(t *testing.T, x *xorm.Engine) {
	t.Helper()
	idx := slices.IndexFunc(migrations, func(m *xormigrate.Migration) bool { return m.ID == "20261107170233" })
	require.NotEqual(t, -1, idx)
	require.NoError(t, migrations[idx].Migrate(x))
}

func TestAddTaskBucketsEnteredAt20261107170233(t *testing.T) {
	x, err := db.CreateTestEngine()
	require.NoError(t, err)

	tables := []any{
		taskBucketBefore20261107170233{},
		task20261107170233{},
		projectView20261107170233{},
	}
	t.Cleanup(func() {
		require.NoError(t, x.DropTables(tables...))
	})
	require.NoError(t, x.DropTables(tables...))
	require.NoError(t, x.Sync2(tables...))

	created := time.Date(2025, 3, 1, 8, 30, 0, 0, time.UTC)
	doneAt := time.Date(2026, 1, 15, 17, 45, 0, 0, time.UTC)

	// View 10 has done bucket 5, view 11 has none.
	_, err = x.Insert(
		&projectView20261107170233{ID: 10, DoneBucketID: 5},
		&projectView20261107170233{ID: 11, DoneBucketID: 0},
		&task20261107170233{ID: 1, DoneAt: &doneAt, Created: created},
		&task20261107170233{ID: 2, DoneAt: nil, Created: created},
		&task20261107170233{ID: 3, DoneAt: &doneAt, Created: created},
		&task20261107170233{ID: 4, DoneAt: &doneAt, Created: created},
		&task20261107170233{ID: 5, DoneAt: &doneAt, Created: created},
		&task20261107170233{ID: 6, DoneAt: &doneAt, Created: created},
		&task20261107170233{ID: 7, DoneAt: &doneAt, Created: created},
	)
	require.NoError(t, err)
	// xorm writes a zero time as NULL, so year 1 is stored explicitly.
	_, err = x.Table("tasks").Where("id = ?", 3).Update(map[string]any{"done_at": "0001-01-01 00:00:00"})
	require.NoError(t, err)
	_, err = x.Insert(
		&taskBucketBefore20261107170233{TaskID: 1, ProjectViewID: 10, BucketID: 5},
		&taskBucketBefore20261107170233{TaskID: 2, ProjectViewID: 10, BucketID: 5},
		&taskBucketBefore20261107170233{TaskID: 3, ProjectViewID: 10, BucketID: 5},
		&taskBucketBefore20261107170233{TaskID: 4, ProjectViewID: 10, BucketID: 6},
		&taskBucketBefore20261107170233{TaskID: 5, ProjectViewID: 11, BucketID: 7},
		// bucket_id 0 must not match a view without a done bucket (done_bucket_id 0)
		&taskBucketBefore20261107170233{TaskID: 6, ProjectViewID: 11, BucketID: 0},
		&taskBucketBefore20261107170233{TaskID: 7, ProjectViewID: 10, BucketID: 5},
	)
	require.NoError(t, err)

	before := taskBucketsTable20261107170233(t, x)
	require.NotEmpty(t, before.Indexes)

	runMigration20261107170233(t, x)

	after := taskBucketsTable20261107170233(t, x)
	require.NotNil(t, after.GetColumn("entered_at"))
	for _, column := range before.ColumnsSeq() {
		require.NotNilf(t, after.GetColumn(column), "migration dropped column %s", column)
	}
	for name, index := range before.Indexes {
		preserved, found := after.Indexes[name]
		require.Truef(t, found, "migration dropped index %s", name)
		require.Equal(t, index.Type, preserved.Type)
		require.Equal(t, index.Cols, preserved.Cols)
	}
	uniqueFound := false
	for _, index := range after.Indexes {
		if index.Type == schemas.UniqueType && slices.Equal(index.Cols, []string{"task_id", "project_view_id"}) {
			uniqueFound = true
		}
	}
	require.True(t, uniqueFound, "the unique task_view index is missing")

	enteredAt := func(taskID int64) time.Time {
		row := &taskBucketAfter20261107170233{}
		found, err := x.Where("task_id = ?", taskID).Get(row)
		require.NoError(t, err)
		require.True(t, found)
		require.NotNilf(t, row.EnteredAt, "task %d was not backfilled", taskID)
		return *row.EnteredAt
	}

	assert.WithinDuration(t, doneAt, enteredAt(1), time.Second, "done bucket and done_at: done_at")
	assert.WithinDuration(t, created, enteredAt(2), time.Second, "done bucket and NULL done_at: created")
	assert.WithinDuration(t, created, enteredAt(3), time.Second, "done bucket and year 1 done_at: created")
	assert.WithinDuration(t, created, enteredAt(4), time.Second, "not the done bucket: created")
	assert.WithinDuration(t, created, enteredAt(5), time.Second, "view without done bucket: created")
	assert.WithinDuration(t, created, enteredAt(6), time.Second, "bucket 0 in a view without done bucket: created")

	t.Run("a row that already has entered_at is untouched", func(t *testing.T) {
		own := time.Date(2026, 5, 5, 5, 5, 5, 0, time.UTC)
		_, err := x.Where("task_id = ?", 7).Cols("entered_at").Update(&taskBucketAfter20261107170233{EnteredAt: &own})
		require.NoError(t, err)

		runMigration20261107170233(t, x)

		assert.WithinDuration(t, own, enteredAt(7), time.Second)
		assert.WithinDuration(t, doneAt, enteredAt(1), time.Second)
	})
}

func taskBucketsTable20261107170233(t *testing.T, x *xorm.Engine) *schemas.Table {
	t.Helper()
	tables, err := x.DBMetas()
	require.NoError(t, err)
	for _, table := range tables {
		if table.Name == "task_buckets" {
			return table
		}
	}
	t.Fatal("task_buckets table not found")
	return nil
}
