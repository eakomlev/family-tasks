#!/usr/bin/env bash
# Обновление приложения на сервере одной командой: ./update.sh
#
# Что делает:
#   1. забирает свежий код (git pull без слияний: если на сервере есть свои правки кода, остановится);
#   2. делает резервную копию БД в backups/ (хранятся последние 14);
#   3. пересобирает и перезапускает контейнеры (миграции БД сервер применяет сам при старте);
#   4. проверяет, что приложение ответило, и при ошибке показывает логи и как откатиться;
#   5. удаляет устаревшие образы Docker.
#
# Параметры:
#   --no-backup   не делать резервную копию БД (быстрее, но без страховки)
#   -h, --help    эта справка
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

KEEP_BACKUPS=14
HEALTH_ATTEMPTS=30   # проверок по 2 секунды, то есть до минуты ожидания

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }
say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nОШИБКА: %s\n' "$*" >&2; exit 1; }

BACKUP=1
for arg in "$@"; do
  case "$arg" in
    --no-backup) BACKUP=0 ;;
    -h | --help) usage; exit 0 ;;
    *) printf 'Неизвестный параметр: %s\n\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

command -v docker >/dev/null 2>&1 || fail 'Docker не установлен.'
docker compose version >/dev/null 2>&1 || fail 'Нужен Docker Compose v2 (команда «docker compose»).'
git rev-parse --git-dir >/dev/null 2>&1 || fail 'Скрипт нужно запускать из репозитория с проектом.'
[ -f .env ] || fail 'Нет файла .env. Скопируйте .env.example и заполните его (README, раздел «Деплой на сервер»).'

PREV=$(git rev-parse --short HEAD)
BACKUP_FILE=''

# Подсказка при неудаче: как вернуть предыдущую версию.
rollback_help() {
  cat >&2 <<EOF

Как вернуть предыдущую версию ($PREV):
  git checkout $PREV && docker compose up -d --build
Миграции БД при откате кода сами не откатываются.${BACKUP_FILE:+
Копия БД перед обновлением: $BACKUP_FILE
Восстановление описано в README (раздел про резервные копии).}
Вернуться потом на свежую версию: git checkout main && git pull
EOF
}

say '1/5 Получаю изменения из репозитория'
git pull --ff-only || fail 'Не удалось обновить код. Если на сервере менялись файлы проекта, посмотрите «git status»: свои правки нужно убрать или сохранить.'
NEW=$(git rev-parse --short HEAD)

if [ "$PREV" = "$NEW" ]; then
  echo "Новых коммитов нет (версия $NEW). Пересоберу на случай изменений в .env."
else
  echo "Обновление $PREV → $NEW:"
  git log --oneline "$PREV..$NEW"
  if ! git diff --quiet "$PREV" "$NEW" -- .env.example; then
    printf '\nВНИМАНИЕ: изменился шаблон настроек .env.example. Проверьте, нет ли новых переменных, которые нужно добавить в .env:\n'
    git --no-pager diff "$PREV" "$NEW" -- .env.example | grep -E '^[+-][^+-]' || true
  fi
  if [ -n "$(git diff --name-only "$PREV" "$NEW" -- server/migrations)" ]; then
    echo
    echo 'В обновлении есть миграции БД: они применятся при запуске сервера.'
  fi
fi

say '2/5 Резервная копия базы данных'
if [ "$BACKUP" -eq 0 ]; then
  echo 'Пропущено (--no-backup).'
elif ! docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo 'БД ещё не запущена (первый запуск?): копировать нечего.'
else
  mkdir -p backups
  BACKUP_FILE="backups/db-$(date +%Y%m%d-%H%M%S).sql.gz"
  if docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_FILE" \
    && gzip -t "$BACKUP_FILE" && [ "$(wc -c < "$BACKUP_FILE")" -gt 200 ]; then
    echo "Сохранено: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    # храним только последние копии
    ls -1t backups/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | while read -r old; do rm -f -- "$old"; done
  else
    rm -f -- "$BACKUP_FILE"
    fail 'Не удалось сделать резервную копию БД, обновление остановлено. Повторите или запустите с --no-backup, если копия не нужна.'
  fi
fi

say '3/5 Собираю и запускаю контейнеры'
docker compose up -d --build

say '4/5 Проверяю, что приложение отвечает'
healthy=0
for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if docker compose exec -T server wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"ok"'; then
    healthy=1
    break
  fi
  sleep 2
done
if [ "$healthy" -ne 1 ]; then
  printf '\nСервер не ответил за %s секунд. Последние строки лога:\n\n' $((HEALTH_ATTEMPTS * 2)) >&2
  docker compose logs --tail 40 server >&2 || true
  rollback_help
  exit 1
fi
echo 'Сервер и база работают.'

# Если задан домен, проверяем ещё и снаружи (HTTPS через Caddy); сертификат может выпускаться не сразу.
DOMAIN_VALUE=$(grep -E '^DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)
if [ -n "$DOMAIN_VALUE" ] && command -v curl >/dev/null 2>&1; then
  public_ok=0
  for _ in 1 2 3 4 5 6; do
    if curl -fsS -m 10 -o /dev/null "https://$DOMAIN_VALUE/api/health" 2>/dev/null; then
      public_ok=1
      break
    fi
    sleep 5
  done
  if [ "$public_ok" -eq 1 ]; then
    echo "Сайт отвечает по HTTPS: https://$DOMAIN_VALUE"
  else
    echo "ПРЕДУПРЕЖДЕНИЕ: https://$DOMAIN_VALUE пока не отвечает. Если домен или сертификат новые, подождите минуту и проверьте: docker compose logs caddy" >&2
  fi
fi

say '5/5 Убираю устаревшие образы Docker'
docker image prune -f >/dev/null
echo 'Готово.'

printf '\nВерсия: %s\n\n' "$NEW"
docker compose ps
