#!/bin/sh

mkdir -p .vscode/schema/{moon,splatnet2,nooklink}

npx ts-json-schema-generator --path src/api/moon-types.ts --type DailySummary > .vscode/schema/moon/dailysummary.schema.json
npx ts-json-schema-generator --path src/api/moon-types.ts --type MonthlySummary > .vscode/schema/moon/monthlysummary.schema.json

npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type Records > .vscode/schema/splatnet2/records.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type NicknameAndIcon > .vscode/schema/splatnet2/ni.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type Timeline > .vscode/schema/splatnet2/timeline.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type HeroRecords > .vscode/schema/splatnet2/hero.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type Results > .vscode/schema/splatnet2/results-summary.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type ResultWithPlayerNicknameAndIcons > .vscode/schema/splatnet2/result.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type CoopResults > .vscode/schema/splatnet2/coop-summary.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type CoopResultWithPlayerNicknameAndIcons > .vscode/schema/splatnet2/coop-result.schema.json

npx ts-json-schema-generator --path src/api/nooklink-types.ts --type Newspaper > .vscode/schema/nooklink/newspaper.schema.json
