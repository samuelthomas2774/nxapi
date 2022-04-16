#!/bin/sh

mkdir -p .vscode/schema/{moon,splatnet2,nooklink}

npx ts-json-schema-generator --path src/api/moon-types.ts --type DailySummary --no-type-check > .vscode/schema/moon/dailysummary.schema.json
npx ts-json-schema-generator --path src/api/moon-types.ts --type MonthlySummary --no-type-check > .vscode/schema/moon/monthlysummary.schema.json

npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type Records --no-type-check > .vscode/schema/splatnet2/records.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type NicknameAndIcon --no-type-check > .vscode/schema/splatnet2/ni.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type Timeline --no-type-check > .vscode/schema/splatnet2/timeline.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type HeroRecords --no-type-check > .vscode/schema/splatnet2/hero.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type Results --no-type-check > .vscode/schema/splatnet2/results-summary.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type ResultWithPlayerNicknameAndIcons --no-type-check > .vscode/schema/splatnet2/result.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type CoopResults --no-type-check > .vscode/schema/splatnet2/coop-summary.schema.json
npx ts-json-schema-generator --path src/api/splatnet2-types.ts --type CoopResultWithPlayerNicknameAndIcons --no-type-check > .vscode/schema/splatnet2/coop-result.schema.json

npx ts-json-schema-generator --path src/api/nooklink-types.ts --type Newspaper --no-type-check > .vscode/schema/nooklink/newspaper.schema.json
