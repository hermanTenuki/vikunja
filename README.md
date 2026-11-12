# Vikunja — форк v2.8.0

Форк [go-vikunja/vikunja](https://github.com/go-vikunja/vikunja) от тега `v2.8.0` (`6e788bf87`). Свои изменения живут в ветке `v2.8.0-dev`, а `main` — зеркало upstream.

Документация upstream — [vikunja.io/docs](https://vikunja.io/docs/). Правила работы с кодом — в [`CLAUDE.md`](CLAUDE.md) и [`.agents/docs/`](.agents/docs/).

## Доработки

| Коммит | Что изменено |
|---|---|
| `1e9067c43` | На карточке видно, сколько времени она провела в текущей колонке. Миграция БД добавляет поле `task_buckets.entered_at` |
| `e69be4759` | Задача открывается сразу после создания |
| `000440d8f` | Главная страница — пульт: карточки из отмеченных колонок, избранные доски, дедлайны. У колонок есть отметка «показывать / скрывать на главной» |
| `e883f96fc` | Новые карточки появляются внизу колонки или списка |
| `c27bdac49` | Карточка с датой начала в будущем «спит»; дата окончания больше не заполняется сама |
| `bad0a430a` | Близкий и просроченный дедлайн подсвечивается |
| `3f461a52a` | Пять уровней приоритета со значками |

## Сборка и деплой

Образ собирает workflow [`fork-image.yml`](.github/workflows/fork-image.yml) при публикации релиза с тегом `build-N` на ветке `v2.8.0-dev`. Готовый образ попадает в `ghcr.io/hermantenuki/vikunja` с тегами `build-N` и `latest`.

Версия бинарника считается через `git describe --match 'v*'`, поэтому в форке нужен тег `v2.8.0`. Свои теги не начинаются с `v`, потому что на теги `v*` реагирует upstream-`ci.yml`.

Сервер запускает образ через [`deploy/`](deploy/). Переменные задаются в `.env` по образцу `.env.example`, тег образа — в `IMAGE_TAG`. Обновление и откат на другой тег выполняются одной командой:

```bash
docker compose pull && docker compose up -d
```

## Дамп

Все команды запускаются из `deploy/`.

Снять дамп и скопировать его на хост:

```bash
NAME=vikunja-dump-$(date +%F-%H%M)
docker compose exec -T vikunja /app/vikunja/vikunja dump -p /tmp -f "$NAME"
docker compose cp "vikunja:/tmp/$NAME.zip" ./
```

Восстановить из дампа (текущая БД при этом стирается):

```bash
docker compose stop vikunja
cp "$NAME.zip" data/db/ && chown 1000:1000 "data/db/$NAME.zip"
printf 'Yes, I understand\n\n' | docker compose run --rm -T vikunja restore "/db/$NAME.zip"
docker compose start vikunja
```

Особенности:
- **`-p /tmp` обязателен.** Папка по умолчанию `/app/vikunja/` принадлежит root, и без `-p` дамп падает с `permission denied`.
- **Имя файла должно быть новым.** Существующий файл дамп не перезаписывает.
- **Нужен `chown`.** Дамп создаётся с правами `0600`, а после `docker compose cp` его владелец — root.
- **Версии должны совпадать.** Restore сверяет версию из дампа с версией бинарника, так что дамп восстанавливается только тем же образом `build-N`.
- **Дамп снимается до обновления образа.** `dump`, как и старт сервера, сначала прогоняет миграции.
- **В архиве лежит `.env` с секретами.** Копия вне сервера хранится только зашифрованной.

## Тесты и линтеры

- Бэкенд: `mage test:web`, `mage test:feature`, `mage test:filter <фильтр>`, `mage lint:fix`.
- Фронт, в `frontend/`: `pnpm lint:fix`, `pnpm lint:styles:fix`, `pnpm typecheck`.
- e2e: `mage test:e2e`.

Подробности — в [`.agents/docs/testing.md`](.agents/docs/testing.md).

## Обновление на новый upstream

Доработки переносятся на новый тег в отдельную ветку, а `v2.8.0-dev` остаётся как есть:

```bash
git fetch upstream --tags
git switch main && git merge --ff-only upstream/main && git push origin main
git branch vNEW-dev v2.8.0-dev
git rebase --onto vNEW v2.8.0 vNEW-dev
git push origin vNEW
```

Перед обновлением сервера снимается дамп. Новые миграции upstream, которые трогают `task_buckets`, могут задеть поле `entered_at`:

```bash
git diff v2.8.0 vNEW -- pkg/migration | grep task_buckets
```

---

## License

Most of this repository is licensed under [AGPL‑3.0‑or‑later](LICENSE).
The contents of [`desktop/`](desktop/) are licensed under
[GPL‑3.0‑or‑later](desktop/LICENSE).

Это модифицированная версия Vikunja; исходники изменений — ветка `v2.8.0-dev` этого репозитория.

### Unsplash Images

Background images from Unsplash are distributed under the [Unsplash License](https://unsplash.com/license). The license requires giving credit to the photographer and Unsplash. See [Unsplash’s terms](https://unsplash.com/terms) for more information.
