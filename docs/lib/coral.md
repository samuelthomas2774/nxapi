`nxapi/coral`
---

Using this module requires sending an authentication token (as a JSON Web Token, containing account identifiers itself) to third-party APIs. If you use this module in your own project, you must read https://github.com/frozenpandaman/splatnet2statink/wiki/api-docs and https://github.com/JoneWang/imink/wiki/imink-API-Documentation if you intend to share anything you create, and explain this to your users and provide a link to the [Coral client authentication](../../README.md#coral-client-authentication) section of nxapi's README. Do not contact any service without the user's informed consent.

### `CoralApi`

> This is exported as `default`.

Coral API client. An instance of this class should not be created directly; instead one of the `createWith*` static methods should be used.

Most of this API is intentionally undocumented. Read the source code at [src/api/coral.ts](../../src/api/coral.ts), [src/common/auth/coral.ts](../../src/common/auth/coral.ts) and [src/cli/nso](../../src/cli/nso) for examples of using this API. If you need any help using this API ask in [#coral](https://discordapp.com/channels/998657768594608138/998662583433318440) on Discord.

You should review HTTP captures of the Nintendo Switch Online app and attempt to match the behaviour of Nintendo's official app. For example, when opening the app it will fetch announcements, friends, web services and the active event; your project should match this.

#### `CoralApi.createWithSessionToken`

Authenticate to the Coral API using a Nintendo Account session token.

> This function should not be called often. If your project will create a new CoralApi object again for the same user before the Coral authentication token expires (usually after two hours), you must store the `data` object this returns and use `CoralApi.createWithSavedToken`.

```ts
import CoralApi, { CoralAuthData } from 'nxapi/coral';

const na_session_token: string;

const {nso, data} = await CoralApi.createWithSessionToken(na_session_token);
// nso instanceof CoralApi
// data is a plain object of type CoralAuthData
// data should be saved and reused
```

#### `CoralApi.createWithSavedToken`

Create a CoralApi instance using cached data from `CoralApi.createWithSessionToken` or `CoralApi.loginWithSessionToken`.

```ts
import CoralApi, { CoralAuthData } from 'nxapi/coral';

const auth_data: CoralAuthData;

const coral = CoralApi.createWithSavedToken(auth_data);
// coral instanceof CoralApi
```

#### `CoralApi.renewToken`

Renew the Coral authentication token. This should be called if any API requests throw a token expired error. This updates the token of the `CoralApi` object and returns a partial `CoralAuthData` object, that should replace properties of the object passed to `CoralApi.createWithSavedToken`.

> This function should not be called often. You must store the object this returns (replacing properties of the previous `CoralAuthData` object).

```ts
import CoralApi, { CoralAuthData, PartialCoralAuthData } from 'nxapi/coral';

const coral: CoralApi;
const auth_data: CoralAuthData;

const data = await coral.renewToken(auth_data);
// data is a plain object of type PartialCoralAuthData

const new_auth_data = Object.assign({}, auth_data, data);
// new_auth_data is a plain object of type CoralAuthData
// new_auth_data should be saved and reused
```

### `ZncProxyApi`

nxapi API proxy server client. Instances of this class are generally compatible with `CoralApi`; nxapi's command line interface and Electron apps internally use either depending on whether the API proxy is enabled.

The API proxy will cache data and will request certain data together to match Nintendo's app, however you should still try to only make requests that would match the behaviour of Nintendo's app as with `CoralApi`.

#### `new ZncProxyApi`

Create a `ZncProxyApi` instance with a Nintendo Account session token.

Because the API proxy server handles Nintendo Account authentication, you do not need to store any data to reuse later, and should call the constructor directly instead of using a helper function.

```ts
import { ZncProxyApi } from 'nxapi/coral';

const znc_proxy_url: string;
const na_session_token: string;

const coral = new ZncProxyApi(znc_proxy_url, na_session_token);
```

### API types

`nxapi/coral` exports all API types from [src/api/coral-types.ts](../../src/api/coral-types.ts).

### Coral client authentication

`nxapi/coral` exports it's API library and types for various APIs used for generating `f` tokens used to authenticate to the Coral API. These functions should generally not be required as they are used by nxapi internally.
