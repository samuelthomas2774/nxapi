#!/bin/bash

# Run as /opt/Nintendo Switch Online/nxapi

APP_BUNDLE_PATH="$(dirname "$0")"
export ELECTRON_RUN_AS_NODE=1

exec "$APP_BUNDLE_PATH/nxapi-app" "$APP_BUNDLE_PATH/resources/app/dist/bundle/cli-bundle.js" $@
