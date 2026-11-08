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
	"time"

	"src.techknowlogick.com/xormigrate"
	"xorm.io/xorm"
)

type taskBuckets20261107170233 struct {
	EnteredAt time.Time `xorm:"null 'entered_at'"`
}

func (taskBuckets20261107170233) TableName() string {
	return "task_buckets"
}

func init() {
	migrations = append(migrations, &xormigrate.Migration{
		ID:          "20261107170233",
		Description: "Add entered_at column to task_buckets and backfill it",
		Migrate: func(tx *xorm.Engine) error {
			if err := partialSync(tx, taskBuckets20261107170233{}); err != nil {
				return err
			}

			// Done bucket of its view and a real done_at: the task entered it when it was
			// completed. Everything else: the best known lower bound is the task creation.
			// A zero done_at may be stored as NULL or as year 1, hence the lower bound.
			_, err := tx.Exec(`UPDATE task_buckets SET entered_at = COALESCE(
	(
		SELECT tasks.done_at FROM tasks
		WHERE tasks.id = task_buckets.task_id
			AND tasks.done_at IS NOT NULL
			AND tasks.done_at > '1970-01-02 00:00:00'
			AND EXISTS (
				SELECT 1 FROM project_views
				WHERE project_views.id = task_buckets.project_view_id
					AND project_views.done_bucket_id <> 0
					AND project_views.done_bucket_id = task_buckets.bucket_id
			)
	),
	(SELECT tasks.created FROM tasks WHERE tasks.id = task_buckets.task_id)
) WHERE entered_at IS NULL`)
			return err
		},
		Rollback: func(tx *xorm.Engine) error {
			return nil
		},
	})
}
