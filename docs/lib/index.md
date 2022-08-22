Usage as a JavaScript library
---

nxapi exports it's API library and types. nxapi is split into several modules that can be imported separately.

> You must set a user agent string using the `addUserAgent` function when using anything that contacts non-Nintendo APIs, such as the splatnet2statink API.

> Please read https://github.com/frozenpandaman/splatnet2statink/wiki/api-docs and https://github.com/JoneWang/imink/wiki/imink-API-Documentation if you intend to share anything you create.

> By default nxapi will fetch certain settings, mostly version numbers to report to Nintendo, from my server. This can be disabled using environment variables.

> nxapi uses native ECMAScript modules. nxapi also uses features like top-level await, so it cannot be converted to CommonJS using Rollup or similar. If you need to use nxapi from CommonJS modules or other module systems, use a [dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).

> If you need any help using nxapi as a library [join the Discord server](https://discord.com/invite/4D82rFkXRv) or [create a discussion](https://github.com/samuelthomas2774/nxapi/discussions/new).

### Install

nxapi should be installed as a project dependency rather than a globally installed package. TypeScript definitions are included and do not need to be installed separately.

```sh
# From registry.npmjs.com
npm install nxapi

# From gitlab.fancy.org.uk
npm install --registry https://gitlab.fancy.org.uk/api/v4/packages/npm/ @samuel/nxapi

# From npm.pkg.github.com
npm install --registry https://npm.pkg.github.com @samuelthomas2774/nxapi

# From gitlab.com
npm install --registry https://gitlab.com/api/v4/packages/npm/ @samuelthomas2774/nxapi
```

### `nxapi`

This module contains some generic utility functions and types.

#### `getTitleIdFromEcUrl`

This function takes a https://ec.nintendo.com/apps/... URL (provided by some Nintendo APIs) and returns the title ID in the URL. `null` is returned if the URL is not a valid Nintendo eShop URL containing a title ID.

```ts
import { getTitleIdFromEcUrl } from 'nxapi';

const title_id = getTitleIdFromEcUrl('https://ec.nintendo.com/apps/0100f8f0000a2000/GB?lang=en-GB');
// title_id === '0100f8f0000a2000'
```

If you are using Nintendo eShop links but do not know the user's Nintendo eShop region, you may use nxapi's Nintendo eShop region selection page.

> https://fancy.org.uk/api/nxapi/title/0100f8f0000a2000/redirect

Please set an appropriate `source` query string parameter containing your project's name and version if you generate these links automatically.

> https://fancy.org.uk/api/nxapi/title/0100f8f0000a2000/redirect?source=myproject-1.0.0

#### `ErrorResponse`

An instance of this class is thrown when an invalid or failure response is received. This class extends from `Error`.

Note that this is only used when the HTTP response is received correctly (including for non-2xx status codes). If a request fails due to a network error or another reason node-fetch will throw a different error.

```ts
import { ErrorResponse } from 'nxapi';

try {
    // ...
} catch (err) {
    if (err instanceof ErrorResponse) {
        // err.body is the response data as a string
        // err.data is the decoded JSON response data, or undefined if JSON decoding fails
        // err.response is the Response object from node-fetch
        // err.name, err.message and err.stack are inherited from Error
    }
}
```

#### `addUserAgent`

This function is used to set the user agent string to use for non-Nintendo API requests. Any project using nxapi (including as a dependency of another project) must call this function with an appropriate user agent string segment. See [user agent strings](../../README.md#user-agent-strings).

#### `version`

nxapi's version number.

```ts
import { version } from 'nxapi';

// version === '1.3.0'
```

### `nxapi/coral`

This module exports the Coral (Nintendo Switch Online app) API library and types.

[See docs/lib/coral.md.](coral.md)

### `nxapi/moon`

This module exports the Moon (Nintendo Switch Parental Controls app) API library and types.

[See docs/lib/moon.md.](moon.md)

### `nxapi/splatnet2`

This module exports the SplatNet 2 API library and types, as well as functions for calculating X Rank seasons, as this is done by the SplatNet 2 web app, not the API.

[See docs/lib/splatnet2.md.](splatnet2.md)

### `nxapi/nooklink`

This module exports the NookLink API library and types.

[See docs/lib/nooklink.md.](nooklink.md)
