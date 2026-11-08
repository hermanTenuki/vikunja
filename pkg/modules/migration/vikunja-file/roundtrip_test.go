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

package vikunjafile

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"code.vikunja.io/api/pkg/db"
	"code.vikunja.io/api/pkg/files"
	"code.vikunja.io/api/pkg/models"
	"code.vikunja.io/api/pkg/notifications"
	"code.vikunja.io/api/pkg/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExportImportRoundTripRelations(t *testing.T) {
	db.LoadAndAssertFixtures(t)
	files.InitTestFileFixtures(t)
	notifications.Fake()
	t.Cleanup(notifications.Unfake)

	description := strings.Repeat("large description ", 1000)

	s := db.NewSession()
	exporter := &user.User{Username: "roundtrip-exporter", Email: "roundtrip-exporter@example.com"}
	_, err := s.Insert(exporter)
	require.NoError(t, err)
	importer := &user.User{Username: "roundtrip-importer", Email: "roundtrip-importer@example.com"}
	_, err = s.Insert(importer)
	require.NoError(t, err)

	first := &models.Project{Title: "roundtrip first"}
	require.NoError(t, models.CreateProject(s, first, exporter, true, true))
	second := &models.Project{Title: "roundtrip second"}
	require.NoError(t, models.CreateProject(s, second, exporter, true, true))

	parent := &models.Task{Title: "roundtrip parent", ProjectID: first.ID}
	require.NoError(t, parent.Create(s, exporter))
	child := &models.Task{Title: "roundtrip child", ProjectID: first.ID}
	require.NoError(t, child.Create(s, exporter))
	big := &models.Task{Title: "roundtrip big", ProjectID: second.ID, Description: description}
	require.NoError(t, big.Create(s, exporter))

	require.NoError(t, (&models.TaskRelation{TaskID: parent.ID, OtherTaskID: child.ID, RelationKind: models.RelationKindSubtask}).Create(s, exporter))
	for _, other := range []*models.Task{parent, child} {
		require.NoError(t, (&models.TaskRelation{TaskID: other.ID, OtherTaskID: big.ID, RelationKind: models.RelationKindRelated}).Create(s, exporter))
	}

	_, err = models.ExportUserData(s, exporter)
	require.NoError(t, err)
	exportFile, err := models.GetUserDataExportFile(s, exporter)
	require.NoError(t, err)
	require.NoError(t, s.Commit())
	_ = s.Close()

	require.NoError(t, models.OpenUserDataExportFile(exportFile))
	archive, err := io.ReadAll(exportFile.File)
	require.NoError(t, err)
	_ = exportFile.File.Close()

	t.Run("related tasks are exported as references", func(t *testing.T) {
		zr, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
		require.NoError(t, err)
		f, err := zr.Open("data.json")
		require.NoError(t, err)
		data, err := io.ReadAll(f)
		require.NoError(t, err)
		assert.Equal(t, 1, strings.Count(string(data), description))

		var projects []struct {
			Tasks []struct {
				RelatedTasks map[string][]map[string]any `json:"related_tasks"`
			} `json:"tasks"`
		}
		require.NoError(t, json.Unmarshal(data, &projects))
		refs := 0
		for _, p := range projects {
			for _, task := range p.Tasks {
				for _, related := range task.RelatedTasks {
					for _, ref := range related {
						assert.ElementsMatch(t, []string{"id", "project_id"}, slices.Collect(maps.Keys(ref)))
						refs++
					}
				}
			}
		}
		assert.Equal(t, 6, refs)
	})

	t.Run("relations survive the import", func(t *testing.T) {
		m := &FileMigrator{}
		require.NoError(t, m.Migrate(importer, bytes.NewReader(archive), int64(len(archive))))

		s := db.NewSession()
		defer s.Close()

		imported := map[string]*models.Task{}
		for _, title := range []string{parent.Title, child.Title, big.Title} {
			tasks := []*models.Task{}
			require.NoError(t, s.Where("title = ? AND created_by_id = ?", title, importer.ID).Find(&tasks))
			require.Len(t, tasks, 1, "task %q", title)
			imported[title] = tasks[0]
		}
		assert.Equal(t, description, imported[big.Title].Description)
		assert.NotEqual(t, imported[parent.Title].ProjectID, imported[big.Title].ProjectID)

		assertRelation := func(from, to string, kind models.RelationKind) {
			db.AssertExists(t, "task_relations", map[string]interface{}{
				"task_id":       imported[from].ID,
				"other_task_id": imported[to].ID,
				"relation_kind": kind,
			}, false)
		}
		assertRelation(parent.Title, child.Title, models.RelationKindSubtask)
		assertRelation(child.Title, parent.Title, models.RelationKindParenttask)
		assertRelation(parent.Title, big.Title, models.RelationKindRelated)
		assertRelation(child.Title, big.Title, models.RelationKindRelated)
		assertRelation(big.Title, parent.Title, models.RelationKindRelated)
	})
}

func TestExportImportRoundTripBucketEnteredAt(t *testing.T) {
	db.LoadAndAssertFixtures(t)
	files.InitTestFileFixtures(t)
	notifications.Fake()
	t.Cleanup(notifications.Unfake)

	s := db.NewSession()
	exporter := &user.User{Username: "entered-at-exporter", Email: "entered-at-exporter@example.com"}
	_, err := s.Insert(exporter)
	require.NoError(t, err)
	importer := &user.User{Username: "entered-at-importer", Email: "entered-at-importer@example.com"}
	_, err = s.Insert(importer)
	require.NoError(t, err)

	project := &models.Project{Title: "entered at project"}
	require.NoError(t, models.CreateProject(s, project, exporter, true, true))
	task := &models.Task{Title: "entered at task", ProjectID: project.ID}
	require.NoError(t, task.Create(s, exporter))

	enteredAt := time.Now().Add(-72 * time.Hour).Truncate(time.Second)
	_, err = s.Where("task_id = ?", task.ID).Cols("entered_at").Update(&models.TaskBucket{EnteredAt: enteredAt})
	require.NoError(t, err)

	_, err = models.ExportUserData(s, exporter)
	require.NoError(t, err)
	exportFile, err := models.GetUserDataExportFile(s, exporter)
	require.NoError(t, err)
	require.NoError(t, s.Commit())
	_ = s.Close()

	require.NoError(t, models.OpenUserDataExportFile(exportFile))
	archive, err := io.ReadAll(exportFile.File)
	require.NoError(t, err)
	_ = exportFile.File.Close()

	zr, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	require.NoError(t, err)
	f, err := zr.Open("data.json")
	require.NoError(t, err)
	data, err := io.ReadAll(f)
	require.NoError(t, err)

	var projects []struct {
		ID          int64 `json:"id"`
		TaskBuckets []struct {
			TaskID    int64     `json:"task_id"`
			EnteredAt time.Time `json:"entered_at"`
		} `json:"task_buckets"`
	}
	require.NoError(t, json.Unmarshal(data, &projects))
	exported := 0
	for _, p := range projects {
		for _, tb := range p.TaskBuckets {
			if tb.TaskID == task.ID {
				exported++
				assert.WithinDuration(t, enteredAt, tb.EnteredAt, time.Second)
			}
		}
	}
	require.Positive(t, exported, "the task's bucket was not exported")

	m := &FileMigrator{}
	require.NoError(t, m.Migrate(importer, bytes.NewReader(archive), int64(len(archive))))

	s2 := db.NewSession()
	defer s2.Close()
	imported := &models.Task{}
	found, err := s2.Where("title = ? AND created_by_id = ?", task.Title, importer.ID).Get(imported)
	require.NoError(t, err)
	require.True(t, found)
	rows := []*models.TaskBucket{}
	require.NoError(t, s2.Where("task_id = ?", imported.ID).Find(&rows))
	require.NotEmpty(t, rows)
	for _, row := range rows {
		assert.WithinDuration(t, enteredAt, row.EnteredAt, time.Second)
	}
}
