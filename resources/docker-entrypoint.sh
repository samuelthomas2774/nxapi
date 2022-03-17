#!/bin/sh

mkdir -p /data/android

exec /app/bin/nxapi.js --data-path /data $@
