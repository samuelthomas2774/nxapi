`nxapi/splatnet2`
---

### `SplatNet2Api`

> This is exported as `default`.

SplatNet 2 API client. An instance of this class should not be created directly; instead one of the `createWith*` static methods should be used.

Most of this API is intentionally undocumented. Read the source code at [src/api/splatnet2.ts](../../src/api/splatnet2.ts), [src/common/auth/splatnet2.ts](../../src/common/auth/splatnet2.ts) and [src/cli/splatnet2](../../src/cli/splatnet2) for examples of using this API. If you need any help using this API ask in [#splatnet2](https://discordapp.com/channels/998657768594608138/998663658781552670) on Discord.

You should review HTTP captures of SplatNet 2 in the Nintendo Switch Online app and attempt to match the behaviour of Nintendo's official app.

#### `SplatNet2Api.createWithCoral`

Authenticate to SplatNet 2 using a `CoralApi` instance.

> This function should not be called often. If your project will create a new SplatNet2Api object again for the same user before the SplatNet 2 session expires (usually 24 hours after last use), you must store the `data` object this returns and use `SplatNet2Api.createWithSavedToken`.

```ts
import CoralApi, { CoralAuthData } from 'nxapi/coral';
import SplatNet2Api, { SplatNet2AuthData } from 'nxapi/splatnet2';

const coral: CoralApi;
const coral_auth_data: CoralAuthData;

const {splatnet, data} = await SplatNet2Api.createWithCoral(coral, coral_auth_data.user);
// splatnet instanceof SplatNet2Api
// data is a plain object of type SplatNet2AuthData
// data should be saved and reused
```

#### `SplatNet2Api.createWithSavedToken`

Create a SplatNet2Api instance using cached data from `SplatNet2Api.createWithCoral` or `SplatNet2Api.loginWithCoral`.

```ts
import SplatNet2Api, { SplatNet2AuthData } from 'nxapi/splatnet2';

const auth_data: SplatNet2AuthData;

const splatnet = SplatNet2Api.createWithSavedToken(auth_data);
// splatnet instanceof SplatNet2Api
```

#### `SplatNet2Api.createWithCliTokenData`

Create a SplatNet2Api instance using the output of the `nxapi splatnet2 token --json` command.

```ts
import SplatNet2Api, { SplatNet2CliTokenData } from 'nxapi/splatnet2';

const data: SplatNet2CliTokenData;

const splatnet = SplatNet2Api.createWithCliTokenData(data);
// splatnet instanceof SplatNet2Api
```

#### `SplatNet2Api.createWithIksmSession`

Create a SplatNet2Api instance with an `iksm_session` and `unique_id` value.

> `SplatNet2Api.createWithCoral`/`SplatNet2Api.createWithSavedToken` or `SplatNet2Api.createWithCliTokenData` should be preferred over this as they are better able to match SplatNet 2's behaviour.

```ts
import SplatNet2Api from 'nxapi/splatnet2';

const iksm_session: string;
const unique_id: string;

const splatnet = SplatNet2Api.createWithIksmSession(iksm_session, unique_id);
// splatnet instanceof SplatNet2Api
```

### API types

`nxapi/splatnet2` exports all API types from [src/api/splatnet2-types.ts](../../src/api/splatnet2-types.ts).

### `toLeagueId`

Converts a `Date` and `LeagueType` to a string used in league ranking requests (`/league_match_ranking/{id}/{region}` or `SplatNet2Api.getLeagueMatchRanking`).

This function does not usually need to be used with `SplatNet2Api.getLeagueMatchRanking`, as a `Date` and `LeagueType` can be passed directly to it.

```ts
import { LeagueType, toLeagueId } from 'nxapi/splatnet2';

const league_id = toLeagueId(new Date(Date.UTC(2022, 0, 1, 0)), LeagueType.TEAM);
// league_id === '22010100T'
```

### `toXRankSeasonId`

Converts a year and month to a string used in X Rank leaderboard requests (`/league_match_ranking/{id}/{region}` or `SplatNet2Api.getLeagueMatchRanking`).

Months in this function start from 1, instead of 0 like `Date`s.

This function does not usually need to be used with `SplatNet2Api.getLeagueMatchRanking`, as a `Date` and `LeagueType` can be passed directly to it.

```ts
import { toXRankSeasonId } from 'nxapi/splatnet2';

const season_id = toXRankSeasonId(2022, 1);
// season_id === '220101T00_220201T00'
```

### `getXRankSeasons`

Returns a generator that yields all X Rank seasons up to the current season according to the system date.

By default this will start from the current season and continue to the first season. Setting the first argument to `true` will cause this function to start from the first season and continue to the current season.

```ts
import { getXRankSeasons, XRankSeason } from 'nxapi/splatnet2';

for (const season of getXRankSeasons()) {
    // season is a plain object of type XRankSeason
}
```

### `getXRankSeason`

Returns an `XRankSeason` object from a `Date`, year and month, or season ID string.

```ts
import { getXRankSeason, XRankSeason } from 'nxapi/splatnet2';

const season = getXRankSeason(2022, 1);
// season is a plain object of type XRankSeason
// season.id === '220101T00_220201T00'
// season.key === '2022_01'
// season.start is a Date object with the UTC timestamp 2022-01-01 00:00:00
// season.end is a Date object with the UTC timestamp 2022-02-01 00:00:00
// season.complete === true, assuming the system time is after 2022-02-01 00:00:00 (UTC)

// This function can also be called like this:
const season = getXRankSeason(new Date(Date.UTC(2022, 1)));
const season = getXRankSeason('220101T00_220201T00');
```

### `getNextXRankSeason`

Returns an `XRankSeason` object for the season following an X Rank season from an `XRankSeason`, `Date`, year and month, or season ID string.

```ts
import { getNextXRankSeason, XRankSeason } from 'nxapi/splatnet2';

const season = getNextXRankSeason(2022, 1);
// season is a plain object of type XRankSeason
// season.id === '220201T00_220301T00'
// season.key === '2022_02'
// season.start is a Date object with the UTC timestamp 2022-02-01 00:00:00
// season.end is a Date object with the UTC timestamp 2022-03-01 00:00:00
// season.complete === true, assuming the system time is after 2022-03-01 00:00:00 (UTC)

// This function can also be called like this:
const season = getNextXRankSeason(new Date(Date.UTC(2022, 1)));
const season = getNextXRankSeason('220101T00_220201T00');
```

### `getPreviousXRankSeason`

Returns an `XRankSeason` object for the season following an X Rank season from an `XRankSeason`, `Date`, year and month, or season ID string.

```ts
import { getNextXRankSeason, XRankSeason } from 'nxapi/splatnet2';

const season = getPreviousXRankSeason(2022, 1);
// season is a plain object of type XRankSeason
// season.id === '211201T00_220101T00'
// season.key === '2021_12'
// season.start is a Date object with the UTC timestamp 2021-12-01 00:00:00
// season.end is a Date object with the UTC timestamp 2022-01-01 00:00:00
// season.complete === true, assuming the system time is after 2022-01-01 00:00:00 (UTC)

// This function can also be called like this:
const season = getPreviousXRankSeason(new Date(Date.UTC(2022, 1)));
const season = getPreviousXRankSeason('220101T00_220201T00');
```
