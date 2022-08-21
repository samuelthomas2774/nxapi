`nxapi/moon`
---

### `MoonApi`

> This is exported as `default`.

Moon API client. An instance of this class should not be created directly; instead one of the `createWith*` static methods should be used.

Most of this API is intentionally undocumented. Read the source code at [src/api/moon.ts](../../src/api/moon.ts), [src/common/auth/moon.ts](../../src/common/auth/moon.ts) and [src/cli/pctl](../../src/cli/pctl) for examples of using this API. If you need any help using this API ask in [#moon](https://discordapp.com/channels/998657768594608138/998662782163628082) on Discord.

You should review HTTP captures of the Nintendo Switch Parental Controls app and attempt to match the behaviour of Nintendo's official app.

#### `MoonApi.createWithSessionToken`

Authenticate to the Moon API using a Nintendo Account session token.

> This function should not be called often. If your project will create a new MoonApi object again for the same user before the Moon authentication token expires (usually after 15 minutes), you must store the `data` object this returns and use `MoonApi.createWithSavedToken`.

```ts
import MoonApi, { MoonAuthData } from 'nxapi/moon';

const na_session_token: string;

const {moon, data} = await MoonApi.createWithSessionToken(na_session_token);
// moon instanceof MoonApi
// data is a plain object of type MoonAuthData
// data should be saved and reused
```

#### `MoonApi.createWithSavedToken`

Create a MoonApi instance using cached data from `MoonApi.createWithSessionToken` or `MoonApi.loginWithSessionToken`.

```ts
import MoonApi, { MoonAuthData } from 'nxapi/moon';

const auth_data: MoonAuthData;

const moon = MoonApi.createWithSavedToken(auth_data);
// moon instanceof MoonApi
```

#### `MoonApi.renewToken`

Renew the Moon authentication token. This should be called if any API requests throw a token expired error. This updates the token of the `MoonApi` object and returns a new `MoonAuthData` object.

```ts
import MoonApi, { MoonAuthData } from 'nxapi/moon';

const moon: MoonApi;
const na_session_token: string;

const data = await moon.renewToken(na_session_token);
// data is a plain object of type MoonAuthData
// data should be saved and reused
```

### API types

`nxapi/moon` exports all API types from [src/api/moon-types.ts](../../src/api/moon-types.ts).
