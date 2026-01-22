#!/usr/bin/env bash
set -euo pipefail

project="giftboard"
server="root@89.58.39.82"
port="6003"
remote_api="/srv/api/${project}"
remote_front="/srv/projects/${project}/frontend"
timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
release_api="${remote_api}/releases/${timestamp}"
release_front="${remote_front}/releases/${timestamp}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required" >&2
  exit 1
fi

echo "🚀 Building frontend..."
npm run build

echo "📁 Preparing remote directories..."
ssh "$server" "mkdir -p '${release_api}' '${release_front}' '${remote_api}' '${remote_front}' '${remote_api}/data' '${remote_api}/uploads'"

echo "🔒 Ensuring shared data/upload ownership..."
ssh "$server" "sudo chown -R www-data:www-data '${remote_api}/data' '${remote_api}/uploads'"

echo "📦 Uploading backend release..."
rsync -az --delete \
  package.json package-lock.json server/ \
  "$server:${release_api}/"

echo "🏃 Updating run script..."
scp server/run "$server:${remote_api}/run"
ssh "$server" "chmod +x '${remote_api}/run'"

echo "📦 Installing backend production deps on server..."
ssh "$server" "cd '${release_api}' && sudo chown -R www-data:www-data '${release_api}' && sudo -u www-data env PATH=/usr/bin:/bin NODE_ENV=production npm ci --omit=dev"

echo "📤 Uploading frontend bundle..."
rsync -az --delete dist/ "$server:${release_front}/"

echo "🔗 Switching symlinks..."
ssh "$server" "ln -sfn '${release_api}' '${remote_api}/current' && ln -sfn '${release_front}' '${remote_front}/current'"

echo "🧠 Refreshing services..."
ssh "$server" "sudo systemctl restart project-backend@${project} && sudo systemctl restart project-frontend@${project}"

echo "✅ Done. Active release: ${timestamp}" \
     " Backend health: curl -fs http://127.0.0.1:${port}/health"
