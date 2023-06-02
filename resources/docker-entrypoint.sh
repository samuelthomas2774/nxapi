#!/bin/sh

mkdir -p /data/android

# Logs will be captured by Docker if enabled
# This is set here so that running another process with `docker exec` (which
# doesn't capture logs) will still write to a file by default
export NXAPI_DEBUG_FILE=0

exec /app/bin/nxapi.js --data-path /data "$@"
