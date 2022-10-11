`nxapi/splatnet3`
---

### `SplatNet3Api`

> This is exported as `default`.

SplatNet 3 API client. An instance of this class should not be created directly; instead one of the `createWith*` static methods should be used.

Most of this API is intentionally undocumented. Read the source code at [src/api/splatnet3.ts](../../src/api/splatnet3.ts), [src/common/auth/splatnet3.ts](../../src/common/auth/splatnet3.ts) and [src/cli/splatnet3](../../src/cli/splatnet3) for examples of using this API. If you need any help using this API ask in [#splatnet3](https://discordapp.com/channels/998657768594608138/998664939537440820) on Discord.

You should review HTTP captures of SplatNet 3 in the Nintendo Switch Online app and attempt to match the behaviour of Nintendo's official app.

#### `SplatNet3Api.createWithCoral`

Authenticate to SplatNet 3 using a `CoralApi` instance.

> This function should not be called often. If your project will create a new SplatNet3Api object again for the same user before the SplatNet 3 authentication token expires (usually after 2 hours), you must store the `data` object this returns and use `SplatNet3Api.createWithSavedToken`.

```ts
import CoralApi, { CoralAuthData } from 'nxapi/coral';
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';

const coral: CoralApi;
const coral_auth_data: CoralAuthData;

const {splatnet, data} = await SplatNet3Api.createWithCoral(coral, coral_auth_data.user);
// splatnet instanceof SplatNet3Api
// data is a plain object of type SplatNet3AuthData
// data should be saved and reused
```

#### `SplatNet3Api.createWithSavedToken`

Create a SplatNet3Api instance using cached data from `SplatNet3Api.createWithCoral` or `SplatNet3Api.loginWithCoral`.

```ts
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';

const auth_data: SplatNet3AuthData;

const splatnet = SplatNet3Api.createWithSavedToken(auth_data);
// splatnet instanceof SplatNet3Api
```

#### `SplatNet3Api.createWithCliTokenData`

Create a SplatNet3Api instance using the output of the `nxapi splatnet3 token --json` command.

```ts
import SplatNet3Api, { SplatNet3CliTokenData } from 'nxapi/splatnet3';

const data: SplatNet3CliTokenData;

const splatnet = SplatNet3Api.createWithCliTokenData(data);
// splatnet instanceof SplatNet3Api
```

#### `SplatNet3Api.onTokenExpired`

Function called when a `401 Unauthorized` response is received from the API, meaning the token has expired.

This function should either call `SplatNet3Api.loginWithWebServiceToken` or `SplatNet3Api.loginWithCoral` to renew the token, then return the `SplatNet3AuthData` object, or call `SplatNet3Api.renewTokenWithWebServiceToken` or `SplatNet3Api.renewTokenWithCoral`. An existing web service token should be used to avoid calling the imink/flapg API, and then fall back to issuing a new token.

```ts
import { ErrorResponse } from 'nxapi';
import CoralApi, { CoralAuthData } from 'nxapi/coral';
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';
import { Response } from 'node-fetch';

let splatnet3_auth_data: SplatNet3AuthData;
const splatnet = SplatNet3Api.createWithSavedToken(splatnet3_auth_data);

splatnet.onTokenExpired = async (response: Response) => {
    try {
        // This should be cached - using stale data is fine, as only the user data is used
        const coral_auth_data: CoralAuthData;

        const data = await SplatNet3Api.loginWithWebServiceToken(splatnet3_auth_data.webserviceToken, coral_auth_data.user);
        // data is a plain object of type SplatNet3AuthData
        // data should be saved and reused

        splatnet3_auth_data = data;

        return data;
    } catch (err) {
        // `401 Unauthorized` from `/api/bullet_tokens` means the web service token has expired (or is invalid)
        if (err instanceof ErrorResponse && err.response.status === 401) {
            const coral: CoralApi;
            const coral_auth_data: CoralAuthData;

            const data = await SplatNet3Api.loginWithCoral(coral, coral_auth_data.user);
            // data is a plain object of type SplatNet3AuthData
            // data should be saved and reused

            splatnet3_auth_data = data;

            return data;
        }

        throw err;
    }
};
```

#### `SplatNet3Api.onTokenShouldRenew`

Function called when the `x-bullettoken-remaining` header received from the API is less than 300, meaning the token will expire in 5 minutes and should be renewed in the background.

```ts
import SplatNet3Api, { SplatNet3AuthData } from 'nxapi/splatnet3';
import { Response } from 'node-fetch';

const splatnet = SplatNet3Api.createWithSavedToken(...);

splatnet.onTokenShouldRenew = async (remaining: number, response: Response) => {
    // See SplatNet3Api.onTokenExpired for an example
};
```

### API types

`nxapi/splatnet3` exports all API types from [src/api/splatnet3-types.ts](../../src/api/splatnet3-types.ts).
