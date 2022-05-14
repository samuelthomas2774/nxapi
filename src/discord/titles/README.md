Title overrides for Discord activities
---

This directory contains custom configuration for titles. The default configuration for all other titles is in [src/discord/titles.ts](../titles.ts). This is used by [src/discord/util.ts](../util.ts) (which also declares the type for title configuration objects) to convert znc presences to Discord activities.

`nxapi util validate-discord-titles` can be used to check title IDs are in the correct format.

Most titles shouldn't have their own Discord application - only the most popular games. Where a title does have it's own Discord application it should also be used for any related titles (e.g. demos, regional variants).

Finding title IDs
---

### 1. Presence

The title ID of the application you are using is included in the Nintendo eShop link in your Nintendo Switch presence. (This is what nxapi uses to find the title ID.)

You can retrieve this using nxapi by:

- Running `nxapi nso user --force-refresh`
- Running `nxapi nso friends --json | jq '.[] | select(.nsaId == "0123456789abcdef").presence'` (where `0123456789abcdef` is the NSA ID of the friend you want to get presence of)
- Clicking the Nintendo eShop button in a Discord activity - Discord will show the link and ask you to confirm opening it, however it will not let you copy the link

The Nintendo eShop link will look like this:

```
https://ec.nintendo.com/apps/0100f8f0000a2000/GB?lang=en-GB
```

In this link, the title ID is `0100f8f0000a2000`.

### 2. Nintendo Switch Parental Controls title download notifications

The title ID of any applications you download are recorded in daily summaries in the Nintendo Switch Parental Controls app. The title doesn't need to be used and the download can be cancelled immediately - it only needs to be queued. This is recorded when queuing downloads of application titles and does not include addon content or update data titles, so the application must be archived or deleted for this to be recorded again.

You can retrieve this using nxapi by running:

```sh
# 0123456789abcdef is the device ID
nxapi pctl daily-summaries 0123456789abcdef --json | jq '.items | .[] | .observations | .[] | select(.type == "DID_APP_DOWNLOAD_START")'
```

### 3. Nintendo Switch Parental Controls usage records

The title ID of any applications you use (for at least 5 minutes in any day) are recorded in daily summaries and monthly summaries in the Nintendo Switch Parental Controls app.

You can retrieve this using nxapi by running:

```sh
# 0123456789abcdef is the device ID
nxapi pctl daily-summaries 0123456789abcdef --json | jq '[ .items | .[] | .playedApps ] | flatten | unique_by(.applicationId)'

nxapi pctl monthly-summary 0123456789abcdef 2022-03 --json | jq '.playedApps | unique_by(.applicationId)'
```

### 4. Captures

Screenshots and screen recordings taken using the capture button are saved to the SD card (or system memory) using the following path format:

```
Album/YYYY/MM/DD/YYYYMMDDHHMMSSII-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.jpg
```

`Y`, `M`, `D`, `H`, `M` and `S` are the timestamp, and `I` is used to identify multiple captures taken on the same second.

`C` is the capture ID, which is used to identify the application/applet open when the capture was taken. The capture ID is just the title ID encrypted using a static key.

Capture IDs can be decrypted using nxapi by running:

```sh
# 397A963DA4660090D65D330174AC6B04 is the capture ID
nxapi util captureid decrypt 397A963DA4660090D65D330174AC6B04
```

### 5. titledb

Title IDs for most titles can be found at https://github.com/blawar/titledb (although some demo title IDs are unavailable).
