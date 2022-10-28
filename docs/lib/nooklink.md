`nxapi/nooklink`
---

NookLink is more complex than other web services as it supports multiple users linked to the same network account:

- `NooklinkApi` is used at NSA-level, and is solely used to list available NookLink users and authenticate to NookLink at ACNH-level.
- `NooklinkUserApi` is used at ACNH-level, and is used to perform all other actions in the NookLink web app.

### `NooklinkApi`

> This is exported as `default`.

NookLink NSA-level API client. An instance of this class should not be created directly; instead one of the `createWith*` static methods should be used.

Most of this API is intentionally undocumented. Read the source code at [src/api/nooklink.ts](../../src/api/nooklink.ts), [src/common/auth/nooklink.ts](../../src/common/auth/nooklink.ts) and [src/cli/nooklink](../../src/cli/nooklink) for examples of using this API. If you need any help using this API ask in [#nooklink](https://discordapp.com/channels/998657768594608138/998664335062741032) on Discord.

You should review HTTP captures of NookLink in the Nintendo Switch Online app and attempt to match the behaviour of Nintendo's official app.

#### `NooklinkApi.createWithCoral`

Authenticate to NookLink using a `CoralApi` instance.

> This function should not be called often. If your project will create a new NooklinkApi object again for the same user before the NookLink authentication token expires (usually after two hours), you must store the `data` object this returns and use `NooklinkApi.createWithSavedToken`.

```ts
import CoralApi, { CoralAuthData } from 'nxapi/coral';
import NooklinkApi, { NooklinkAuthData } from 'nxapi/nooklink';

const coral: CoralApi;
const coral_auth_data: CoralAuthData;

const {nooklink, data} = await NooklinkApi.createWithCoral(coral, coral_auth_data.user);
// nooklink instanceof NooklinkApi
// data is a plain object of type NooklinkAuthData
// data should be saved and reused
```

#### `NooklinkApi.createWithSavedToken`

Create a NooklinkApi instance using cached data from `NooklinkApi.createWithCoral` or `NooklinkApi.loginWithCoral`.

```ts
import NooklinkApi, { NooklinkAuthData } from 'nxapi/nooklink';

const auth_data: NooklinkAuthData;

const nooklink = NooklinkApi.createWithSavedToken(auth_data);
// nooklink instanceof NooklinkApi
```

#### `NooklinkApi.getUsers`

Retrieves a list of available NookLink-enabled users.

```ts
import NooklinkApi, { Users } from 'nxapi/nooklink';

const nooklink: Nooklink;

const users = await nooklink.getUsers();
// users is a plain object of type Users
```

#### `NooklinkApi.createUserClient`

Authenticate to NookLink and create a NooklinkUser instance.

```ts
import NooklinkApi, { NooklinkUserApi, NooklinkUserAuthData } from 'nxapi/nooklink';

const nooklink: Nooklink;
const user_id: string;

const {nooklinkuser, data} = await nooklink.createUserClient(user_id);
// nooklinkuser instanceof NooklinkUserApi
// data is a plain object of type NooklinkUserAuthData
```

### `NooklinkUserApi`

NookLink ACNH-level API client. An instance of this class should not be created directly; instead `NooklinkApi.createUserClient` or one of the `createWith*` static methods should be used.

Most of this API is intentionally undocumented. Read the source code at [src/api/nooklink.ts](../../src/api/nooklink.ts), [src/common/auth/nooklink.ts](../../src/common/auth/nooklink.ts) and [src/cli/nooklink](../../src/cli/nooklink) for examples of using this API. If you need any help using this API ask in [#nooklink](https://discordapp.com/channels/998657768594608138/998664335062741032) on Discord.

You should review HTTP captures of NookLink in the Nintendo Switch Online app and attempt to match the behaviour of Nintendo's official app.

#### `NooklinkUserApi.createWithSavedToken`

Create a NooklinkUserApi instance using cached data from `NooklinkApi.createUserClient`.

```ts
import { NooklinkUserApi, NooklinkUserAuthData } from 'nxapi/nooklink';

const auth_data: NooklinkAuthData;

const nooklinkuser = NooklinkUserApi.createWithSavedToken(auth_data);
// nooklinkuser instanceof NooklinkApi
```

#### `NooklinkUserApi.createWithCliTokenData`

Create a NooklinkUserApi instance using the output of the `nxapi nooklink user-token --json` command.

```ts
import { NooklinkUserApi, NooklinkUserCliTokenData } from 'nxapi/nooklink';

const data: NooklinkUserCliTokenData;

const nooklinkuser = NooklinkUserApi.createWithCliTokenData(data);
// nooklinkuser instanceof NooklinkUserApi
```

### API types

`nxapi/nooklink` exports all API types from [src/api/nooklink-types.ts](../../src/api/nooklink-types.ts).
