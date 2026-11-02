#!/usr/bin/env bash
# Start a disposable single-node MongoDB replica set in Docker for tests.
# Transactions need a replica set, and GitHub service containers can't pass
# --replSet, so CI (and anyone with Docker) uses this instead.
#
#   scripts/start-mongo-replset.sh            # mongo:7.0 on 127.0.0.1:27028
#   MONGO_PORT=27030 scripts/start-mongo-replset.sh
#
# The member advertises 127.0.0.1:<port>, so a plain mongodb://127.0.0.1:<port>
# connection string discovers the primary without extra options.
set -euo pipefail

port="${MONGO_PORT:-27028}"
image="${MONGO_IMAGE:-mongo:7.0}"
name="${MONGO_CONTAINER:-parksmart-test-mongo}"

docker run -d --rm --name "$name" -p "127.0.0.1:${port}:${port}" "$image" \
  --replSet rs0 --port "$port" --bind_ip_all >/dev/null

mongosh_eval() {
  docker exec "$name" mongosh --port "$port" --quiet --eval "$1"
}

for _ in $(seq 1 30); do
  mongosh_eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1 && break
  sleep 1
done

mongosh_eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:${port}' }] }).ok" >/dev/null

for _ in $(seq 1 30); do
  if [ "$(mongosh_eval 'db.hello().isWritablePrimary' 2>/dev/null)" = "true" ]; then
    echo "MongoDB replica set rs0 is ready on 127.0.0.1:${port}"
    exit 0
  fi
  sleep 1
done

echo "MongoDB replica set did not elect a primary in time" >&2
docker logs "$name" >&2 || true
exit 1
