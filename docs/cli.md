
Nintendo Switch Online
---

### Login to the Nintendo Switch Online app

```sh
# Interactive login
# Generates a link to login with a Nintendo Account, asks for the link then automatically gets a session token
nxapi nso auth

# Login with an existing token
# Use with a token obtained via MITM the app, or with `nxapi nso auth --no-auth`
# The same session token as for the Nintendo Switch Parental Controls app cannot be used
nxapi nso token

# Get the authenticated user
nxapi nso user
```

### Discord Presence

```sh
# Show the authenticated user's presence
nxapi nso presence

# Show a friend's presence
# Use `nxapi nso friends` to show all friend's Nintendo Switch account IDs
nxapi nso presence --friend-nsaid 0123456789abcdef

# Show the authenticated user's friend code in Discord
nxapi nso presence --friend-code
nxapi nso presence --friend-code -

# Show a custom friend code in Discord
# Use this if you are showing presence of a friend of the authenticated user
nxapi nso presence --friend-code 0000-0000-0000
nxapi nso presence --friend-code SW-0000-0000-0000

# Show inactive presence
# This will show a "Not playing" status if any consoles linked to the user's account is online but the user
# is not selected in a game
# Don't enable this if you are not the only user of all consoles linked to your account
nxapi nso presence --show-inactive-presence

# Also show friend notifications (see below)
nxapi nso presence --friend-notifications
nxapi nso presence --user-notifications --friend-notifications
nxapi nso presence --user-notifications

# Set update interval to 60 seconds
nxapi nso presence --update-interval 60

# Fetch presence from a custom URL (see `nxapi nso http-server`)
nxapi nso presence --presence-url "http://[::1]:12345/api/znc/user/presence"
nxapi nso presence --presence-url "http://[::1]:12345/api/znc/friend/0123456789abcdef/presence"
```

### Friend presence notifications

This uses node-notifier to display native desktop notifications.

```sh
# Show notifications for all friends
nxapi nso notify

# Show notifications for all friends + the current user
nxapi nso notify --user-notifications

# Show notifications for only the current user
nxapi nso notify --user-notifications --no-friend-notifications

# Set update interval to 60 seconds
nxapi nso notify --update-interval 60
```

### Friends

```sh
# Show Nintendo Switch friends in a table
nxapi nso friends

# JSON
nxapi nso friends --json
nxapi nso friends --json-pretty-print
```

### Friend codes and friend requests

```sh
# Get a URL that can be used to open your profile in the Nintendo Switch Online app and send a friend request
# This prints an object which includes your friend code and the URL (which contains your friend code)
nxapi nso friendcode

# JSON
nxapi nso friendcode --json
nxapi nso friendcode --json-pretty-print

# Look up a user using a friend code
nxapi nso lookup 0000-0000-0000

# JSON
nxapi nso lookup 0000-0000-0000 --json
nxapi nso lookup 0000-0000-0000 --json-pretty-print

# Send a friend request
nxapi nso add-friend 0000-0000-0000
```

### Nintendo Switch Online app announcements/alerts

```sh
# Show app announcements in a table
nxapi nso announcements

# JSON
nxapi nso announcements --json
nxapi nso announcements --json-pretty-print
```

### Web services/game-specific services

```sh
# Show web services in a table
nxapi nso webservices

# JSON
nxapi nso webservices --json
nxapi nso webservices --json-pretty-print

# Get an access token for a web service
# This should be sent with the first request to the web service URL in the `x-gamewebtoken` header
nxapi nso webservicetoken 5741031244955648
nxapi nso webservicetoken 5741031244955648 --json
nxapi nso webservicetoken 5741031244955648 --json-pretty-print
```

### API proxy server

Use this to access the Nintendo Switch Online app API from a browser/other HTTP client easily.

```sh
# Start the server listening on all interfaces on a random port
nxapi nso http-server

# Start the server listening on a specific address/port
# The `--listen` option can be used multiple times
nxapi nso http-server --listen "[::1]:12345"

# Use the API proxy server in other commands
nxapi nso ... --znc-proxy-url "http://[::1]:12345/api/znc"
ZNC_PROXY_URL=http://[::1]:12345/api/znc nxapi nso ...

# Start the server using another API proxy server
nxapi nso http-server --znc-proxy-url "http://[::1]:12345/api/znc"
ZNC_PROXY_URL=http://[::1]:12345/api/znc nxapi nso http-server

# Allow requests without a Nintendo Account session token
# Anyone connecting to the API proxy server will be able to use any already authenticated user with their Nintendo Account ID
# Don't set this if anyone can connect to the server!
nxapi nso http-server --listen "[::1]:12345" --no-require-token

# Limit the frequency of friends/announcements/web services requests to 60 seconds
nxapi nso http-server --update-interval 60

# Make API requests using curl
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/auth"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/announcements"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/friends"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/friends/presence"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/friend/0123456789abcdef"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/friend/0123456789abcdef/presence"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/friendcode"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/friendcode/0000-0000-0000"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/webservices"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/webservice/5741031244955648/token"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/activeevent"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/user"
curl --header "Authorization: na $NA_SESSION_TOKEN" "http://[::1]:12345/api/znc/user/presence"

# Watch for changes to the user and all friends presence
curl --header "Authorization: na $NA_SESSION_TOKEN" --no-buffer "http://[::1]:12345/api/znc/presence/events"

# Make API requests using curl without a session token
# The `--no-require-token` must be set when running the server, and the user must have previously authenticated to the server, either with the API proxy server or using commands on the server
curl "http://[::1]:12345/api/znc/announcements?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/friends?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/friends/presence?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/friend/0123456789abcdef?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/friend/0123456789abcdef/presence?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/friendcode?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/friendcode/0000-0000-0000?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/webservices?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/webservice/5741031244955648/token?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/activeevent?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/user?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/user/presence?user=0123456789abcdef"
curl --no-buffer "http://[::1]:12345/api/znc/presence/events?user=0123456789abcdef"
```

SplatNet 2
---

All SplatNet 2 commands may automatically request a web service token. This will involve the imink/flapg API (or a custom server). This can be disabled by setting `--no-auto-update-session`, however this will cause commands to fail if there isn't a valid SplatNet 2 token.

### User

```sh
# Show the authenticated SplatNet 2 user
nxapi splatnet2 user
```

### Download user records

```sh
# Download user records to the splatnet2 directory in nxapi's data path
# Data that already exists will not be redownloaded
nxapi splatnet2 dump-records
# Download user records to data/splatnet2
nxapi splatnet2 dump-records data/splatnet2
# Don't include user records (when downloading other data)
nxapi splatnet2 dump-records --no-user-records

# Include lifetime inkage challenge images
nxapi splatnet2 dump-records --challenges

# Include profile image (share button on the home page)
nxapi splatnet2 dump-records --profile-image
nxapi splatnet2 dump-records --profile-image --favourite-stage "Starfish Mainstage" --favourite-colour purple

# Download user records even if they already exist and haven't been updated
nxapi splatnet2 dump-records --no-new-records

# Include hero (Octo Canyon) records
# If this option is included hero records will always be downloaded even if they haven't been updated
nxapi splatnet2 dump-records --hero-records
# Only download hero records
nxapi splatnet2 dump-records --no-user-records --hero-records

# Include timeline (CPOD FM on the home page)
# If this option is included the timeline will always be downloaded even if it hasn't been updated
nxapi splatnet2 dump-records --timeline
# Only download the timeline
nxapi splatnet2 dump-records --no-user-records --timeline
```

### Download battle/Salmon Run results

```sh
# Download battle and Salmon Run results to the splatnet2 directory in nxapi's data path
# Data that already exists will not be redownloaded
nxapi splatnet2 dump-results
# Download battle and Salmon Run results to data/splatnet2
nxapi splatnet2 dump-results data/splatnet2

# Include battle summary image (share button on the battles list)
nxapi splatnet2 dump-results --battle-summary-image

# Include battle result images (share button on the battle details page)
nxapi splatnet2 dump-results --battle-images

# Only download battle results
nxapi splatnet2 dump-results --no-coop
# Only download Salmon Run results
nxapi splatnet2 dump-results --no-battles

# Download summary data even if user records haven't been updated
# Individual battle results/images/Salmon Run results still won't be redownloaded if they exist
nxapi splatnet2 dump-results --no-check-updated
```

### Monitor SplatNet 2 for new user records/battle/Salmon Run results

This will constantly check SplatNet 2 for new data.

```sh
# Watch for new battle and Salmon Run results and download them to the splatnet2 directory in nxapi's data path
nxapi splatnet2 monitor

# Watch for new battle and Salmon Run results and download them to data/splatnet2
nxapi splatnet2 monitor data/splatnet2

# Include profile image (share button on the home page)
nxapi splatnet2 monitor --profile-image
nxapi splatnet2 monitor --profile-image --favourite-stage "Starfish Mainstage" --favourite-colour purple

# Include battle summary image (share button on the battles list)
nxapi splatnet2 monitor --battle-summary-image

# Include battle result images (share button on the battle details page)
nxapi splatnet2 monitor --battle-images

# Only download battle results
nxapi splatnet2 monitor --no-coop
# Only download Salmon Run results
nxapi splatnet2 monitor --no-battles

# Set update interval to 1800 seconds (30 minutes)
nxapi splatnet2 monitor --update-interval 1800
```

SplatNet 2 monitoring can also be used with `nxapi nso notify` and `nxapi nso presence`. Data will only be downloaded from SplatNet 2 if the authenticated user is playing Splatoon 2 online.

This can be used with `nxapi nso presence --presence-url ...` (the presence URL must return the status of the user authenticating to SplatNet 2). When used with `--friend-nsaid` the friend's presence will be shared on Discord but the authenticated user's presence will still be used to check if SplatNet 2 data should be updated.

```sh
# Watch for new battle and Salmon Run results and download them to the splatnet2 directory in nxapi's data path
# All options support both the notify and presence commands
nxapi nso notify --splatnet2-monitor
nxapi nso presence --splatnet2-monitor

# Watch for new battle and Salmon Run results and download them to data/splatnet2
nxapi nso presence --splatnet2-monitor --splatnet2-monitor-directory data/splatnet2
nxapi nso presence --splatnet2-monitor --sn2-path data/splatnet2

# Include profile image (share button on the home page)
nxapi nso presence --splatnet2-monitor --splatnet2-monitor-profile-image
nxapi nso presence --splatnet2-monitor --sn2-profile-image

nxapi nso presence --splatnet2-monitor --splatnet2-monitor-profile-image --splatnet2-monitor-favourite-stage "Starfish Mainstage" --splatnet2-monitor-favourite-colour purple
nxapi nso presence --splatnet2-monitor --sn2-profile-image --sn2-favourite-stage "Starfish Mainstage" --sn2-favourite-colour purple

# Include battle summary image (share button on the battles list)
nxapi nso presence --splatnet2-monitor --splatnet2-monitor-battle-summary-image
nxapi nso presence --splatnet2-monitor --sn2-battle-summary-image

# Include battle result images (share button on the battle details page)
nxapi nso presence --splatnet2-monitor --splatnet2-monitor-battle-images
nxapi nso presence --splatnet2-monitor --sn2-battle-images

# Only download battle results
nxapi nso presence --splatnet2-monitor --no-splatnet2-monitor-coop
nxapi nso presence --splatnet2-monitor --no-sn2-coop
# Only download Salmon Run results
nxapi nso presence --splatnet2-monitor --no-splatnet2-monitor-battles
nxapi nso presence --splatnet2-monitor --no-sn2-battles

# Set update interval to 60 seconds
nxapi nso presence --splatnet2-monitor --splatnet2-monitor-update-interval 60
nxapi nso presence --splatnet2-monitor --sn2-update-interval 60
```

NookLink
---

All NookLink commands may automatically request a web service token. This will involve the imink/flapg API (or a custom server). This can be disabled by setting `--no-auto-update-session`, however this will cause commands to fail if there isn't a valid NookLink token.

### User

```sh
# Show NookLink users in a table
nxapi nooklink users

# Show the authenticated NookLink user
nxapi nooklink user

# Show the authenticated NookLink user's island and other players
nxapi nooklink island

# Use a specific NookLink user linked to the selected Nintendo Account
# If more than 1 NookLink users exist by default the first user will be used
nxapi nooklink user --islander 0x0123456789abcdef
# --user can also be used to select a different Nintendo Account
nxapi nooklink user --user 0123456789abcdef
nxapi nooklink user --user 0123456789abcdef --islander 0x0123456789abcdef
```

### Newspapers

```sh
# Show the latest newspaper issue in a table
nxapi nooklink newspaper
# JSON
nxapi nooklink newspaper --json
nxapi nooklink newspaper --json-pretty-print

# List newspaper issues in a table
nxapi nooklink newspapers
# JSON
nxapi nooklink newspapers --json
nxapi nooklink newspapers --json-pretty-print

# Show a specific newspaper issue in a table
nxapi nooklink newspaper 00000000-0000-0000-0000-000000000000
# JSON
nxapi nooklink newspaper 00000000-0000-0000-0000-000000000000 --json
nxapi nooklink newspaper 00000000-0000-0000-0000-000000000000 --json-pretty-print
```

### Download newspapers

```sh
# Download all island newspapers to the nooklink directory in nxapi's data path
# Data that already exists will not be redownloaded
nxapi nooklink dump-newspapers

# Download all island newspapers to data/nooklink
nxapi nooklink dump-newspapers data/nooklink
```

### Messages

```sh
# Send a message in an online Animal Crossing: New Horizons session
nxapi nooklink keyboard "Hello"

# Ask for a message interactively
nxapi nooklink keyboard

# List available reactions
nxapi nooklink reactions

# Send a reaction
nxapi nooklink post-reaction happyflower
```

Nintendo Switch Parental Controls
---

### Login to the Nintendo Switch Parental Controls app

```sh
# Interactive login
# Generates a link to login with a Nintendo Account, asks for the link then automatically gets a session token
nxapi pctl auth

# Login with an existing token
# Use with a token obtained via MITM the app, or with `nxapi pctl auth --no-auth`
# The same session token as for the Nintendo Switch Online app cannot be used
nxapi pctl token

# Get the authenticated user
nxapi pctl user
```

### Nintendo Switch consoles

```sh
# Show Nintendo Switch consoles in a table
nxapi pctl devices

# JSON
nxapi pctl devices --json
nxapi pctl devices --json-pretty-print
```

### Daily summaries

```sh
# Show daily summary data in a table
# Use `nxapi pctl devices` to get the device ID
nxapi pctl daily-summaries 0123456789abcdef

# JSON
nxapi pctl daily-summaries 0123456789abcdef --json
nxapi pctl daily-summaries 0123456789abcdef --json-pretty-print
```

### Monthly summaries

```sh
# Show monthly summaries in a table
# Use `nxapi pctl devices` to get the device ID
nxapi pctl monthly-summaries 0123456789abcdef

# JSON
nxapi pctl monthly-summaries 0123456789abcdef --json
nxapi pctl monthly-summaries 0123456789abcdef --json-pretty-print

# Show data for the February 2022 monthly summary in a table
nxapi pctl monthly-summary 0123456789abcdef 2022-02

# JSON
nxapi pctl monthly-summary 0123456789abcdef 2022-02 --json
nxapi pctl monthly-summary 0123456789abcdef 2022-02 --json-pretty-print
```

### Download summary data

```sh
# Download all daily and monthly summary data from all devices to the summaries directory in nxapi's data path
# Data that already exists will not be redownloaded
nxapi pctl dump-summaries

# Download all daily and monthly summary data from all devices to data/summaries
nxapi pctl dump-summaries data/summaries

# Download all daily and monthly summary data from a specific device
# Use `nxapi pctl devices` to get the device ID
# The `--device` option can be used multiple times
nxapi pctl dump-summaries --device 0123456789abcdef
```

Misc. commands/options
---

### Users

```sh
# Show all known Nintendo Accounts in a table
# This will only show cached data and does not make any requests to Nintendo servers
nxapi users list

# Use a specific user in a command
nxapi ... --user 0123456789abcdef
nxapi ... --token $NA_SESSION_TOKEN

# Set the default user for commands
nxapi users set 0123456789abcdef

# Remove all data for a user
nxapi users forget 0123456789abcdef
```

### Electron app

When installing nxapi from source the app can be run using this command:

```sh
nxapi app
```

This command has no options, but environment variables can still be used.

### znca API server

A server for controlling the Nintendo Switch Online app on an Android device/emulator using Frida can be used instead of the imink/flapg APIs to generate `f` parameters for authentication.

This server has a single endpoint, `/api/znca/f`, which is fully compatible with [the imink API](https://github.com/JoneWang/imink/wiki/imink-API-Documentation)'s `/f` endpoint. The following data should be sent as JSON:

```ts
interface AndroidZncaApiRequest {
    /**
     * `"1"` or `1` for Coral (Nintendo Switch Online app) authentication (`Account/Login` and `Account/GetToken`).
     * `"2"` or `2` for web service authentication (`Game/GetWebServiceToken`).
     */
    hash_method: '1' | '2' | 1 | 2;
    /**
     * The token used to authenticate to the Coral API:
     * The Nintendo Account `id_token` for Coral authentication.
     * The Coral access token for web service authentication.
     */
    token: string;
    /**
     * The current timestamp in milliseconds, either as a number or a string.
     */
    timestamp?: string | number;
    /**
     * A random (v4) UUID.
     */
    request_id?: string;
}
```

Due to changes to Nintendo's API on [23/08/2022](https://github.com/samuelthomas2774/nxapi/discussions/10#discussioncomment-3464443) the `timestamp` parameter should not be sent. If the `timestamp` or `request_id` parameters are not sent their values will be generated and returned in the response. Note that unlike the imink API and [nsotokengen](https://github.com/clovervidia/nsotokengen), only parameters not included in the request will be included in the response.

This requires:

- adb is installed on the computer running nxapi
- The Android device is running adbd as root or a su-like command can be used to escalate to root
- The frida-server executable is located at `/data/local/tmp/frida-server` on the Android device (a different path can be provided using the `--frida-server-path` option)
- The Nintendo Switch Online app is installed on the Android device

No other software (e.g. frida-tools) needs to be installed on the computer running nxapi. The Android device must be constantly reachable using ADB. The server will attempt to reconnect to the Android device and will automatically retry any requests that would fail due to the device disconnecting. The server will exit if it fails to reconnect to the device. A service manager should be used to restart the server if it exits.

```sh
# Start the server using the ADB server "android.local:5555" listening on all interfaces on a random port
nxapi android-znca-api-server-frida android.local:5555

# Start the server listening on a specific address/port
# The `--listen` option can be used multiple times
nxapi android-znca-api-server-frida android.local:5555 --listen "[::1]:12345"

# Use a command to escalate to root to start frida-server and the Nintendo Switch Online app
# "{cmd}" will be replaced with the path to a temporary script in double quotes
nxapi android-znca-api-server-frida android.local:5555 --exec-command "/system/bin/su -c {cmd}"

# Specify a different location for the adb executable if it is not in the search path
nxapi android-znca-api-server-frida android.local:5555 --adb-path "/usr/local/bin/adb"

# Run `adb root` when connecting to the device to restart adbd as root
nxapi android-znca-api-server-frida android.local:5555 --adb-root

# Specify a different location for the frida-server executable on the device
nxapi android-znca-api-server-frida android.local:5555 --frida-server-path "/data/local/tmp/frida-server-15.1.17-android-arm"

# Use Frida to start the app on the device (even if it is already running) (recommended)
nxapi android-znca-api-server-frida android.local:5555 --start-method spawn
# Use `am start-activity` to ensure the app process is running
nxapi android-znca-api-server-frida android.local:5555 --start-method activity
# Use `am start-service` to ensure the app process is running, without causing Android to show the app (default)
nxapi android-znca-api-server-frida android.local:5555 --start-method service
# Do not attempt to start the app on the device automatically - this will cause the server to fail if the app is not already running
nxapi android-znca-api-server-frida android.local:5555 --start-method none

# Strictly validate the timestamp and request_id parameters sent by the client are likely to be accepted by Nintendo's API
nxapi android-znca-api-server-frida android.local:5555 --strict-validate

# Don't validate the token sent by the client
nxapi android-znca-api-server-frida android.local:5555 --no-validate-tokens

# Make imink-compatible API requests using curl
curl --header "Content-Type: application/json" --data '{"hash_method": "1", "token": "..."}' "http://[::1]:12345/api/znca/f"
curl --header "Content-Type: application/json" --data '{"hash_method": "1", "token": "...", "request_id": "..."}' "http://[::1]:12345/api/znca/f"
curl --header "Content-Type: application/json" --data '{"hash_method": "1", "token": "...", "timestamp": "...", "request_id": "..."}' "http://[::1]:12345/api/znca/f"

# Make legacy nxapi v1.3.0-compatible API requests using curl
curl --header "Content-Type: application/json" --data '{"type": "nso", "token": "..."}' "http://[::1]:12345/api/znca/f"
curl --header "Content-Type: application/json" --data '{"type": "nso", "token": "...", "uuid": "..."}' "http://[::1]:12345/api/znca/f"
curl --header "Content-Type: application/json" --data '{"type": "nso", "token": "...", "timestamp": "...", "uuid": "..."}' "http://[::1]:12345/api/znca/f"

# Use the znca API server in other commands
# This should be set when running any nso commands as the access token will be refreshed automatically when it expires
ZNCA_API_URL=http://[::1]:12345/api/znca nxapi nso ...
```

Information about the device and the Nintendo Switch Online app, as well as information on how long the request took to process will be included in the response headers.

Header                          | Description
--------------------------------|------------------
`X-Android-Build-Type`          | Android build type, e.g. `user`
`X-Android-Release`             | Android release/marketing version, e.g. `8.0.0`
`X-Android-Platform-Version`    | Android SDK version, e.g. `26`
`X-znca-Platform`               | Device platform - always `Android`
`X-znca-Version`                | App release/marketing version, e.g. `2.2.0`
`X-znca-Build`                  | App build/internal version, e.g. `2832`

The following performance metrics are included in the `Server-Timing` header:

Name        | Description
------------|------------------
`validate`  | Time validating the request body.
`attach`    | Time waiting for the device to become available, start frida-server, start the app and attach the Frida script to the app process. This metric will not be included if the server is already connected to the device.
`queue`     | Time waiting for the processing thread to become available.
`init`      | Time waiting for `com.nintendo.coral.core.services.voip.Libvoipjni.init`.
`process`   | Time waiting for `com.nintendo.coral.core.services.voip.Libvoipjni.genAudioH`/`genAudioH2`.
