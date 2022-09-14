#!/bin/sh

mkdir -p .vscode/schema/generated

npx ts-json-schema-generator --path src/api/moon-types.ts --expose all --no-type-check > .vscode/schema/generated/moon-types.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --expose all --no-type-check > .vscode/schema/generated/splatnet2-types.schema.json
npx ts-json-schema-generator --path src/api/nooklink-types.ts --expose all --no-type-check > .vscode/schema/generated/nooklink-types.schema.json
npx ts-json-schema-generator --path src/api/splatnet3-types.ts --expose all --no-type-check > .vscode/schema/generated/splatnet3-types.schema.json

npx ts-json-schema-generator --path src/common/remote-config.ts --type NxapiRemoteConfig --no-type-check > .vscode/schema/generated/remote-config.schema.json
