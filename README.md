nxapi
===

Access the Nintendo Switch Online and Nintendo Switch Parental Controls app APIs. Includes Discord Rich Presence, friend notifications and data downloads.

### Features

- Command line and menu bar app interfaces
- Interactive Nintendo Account login for the Nintendo Switch Online and Nintendo Switch Parental Controls apps
- Automated login to the Nintendo Switch Online app API
    - This uses splatnet2statink and flapg APIs by default.
    - Alternatively a custom server using a rooted Android device/emulator is included.
- Get Nintendo Switch account information, friends list and game-specific services
- Show Discord Rich Presence using your own or a friend's Nintendo Switch presence
    - Show your account's friend code (or a custom friend code)
    - Fetch presence from a custom URL
    - All titles are supported using a default Nintendo Switch app. A limited number of titles have their own
        Discord apps (meaning they appear under your name with the title's name instead of "Nintendo Switch")
        or other custom Discord features. [See here for Discord title overrides](src/discord/titles.ts) or
        [create an issue if you'd like another title added](https://github.com/samuelthomas2774/nxapi/issues/new/choose).

    ![Screenshot showing Splatoon 2 as a Discord activity](resources/Screenshot%202022-03-31%20at%2017.56.47%203.png)
- Show notifications for friend Nintendo Switch presences

    ![Screenshot showing a presence notification](resources/Screenshot%202022-03-31%20at%2017.56.47%202.png)
- [Electron app] Open game-specific services
    - Including NookLink, which doesn't work in web browsers as it requires custom JavaScript APIs.
- Nintendo Switch Online app API proxy server
    - This allows a single account to fetch presence for multiple users.
    - Data will be cached for a short time to reduce the number of requests to Nintendo's server.
    - This automatically handles authentication when given a Nintendo Account session token. This makes it much
        easier to access the API from a browser, in scripts or in other software.
- Download all personalised SplatNet 2 data, including battle and Salmon Run results
    - This supports monitoring the authenticated user's presence and only checking for new data when playing
        Splatoon 2 online.
- Download island newspapers from and send messages and reactions using NookLink
- Download all Nintendo Switch Parental Controls usage records

The API library and types are exported for use in JavaScript/TypeScript software. The app/commands properly cache access tokens and try to handle requests to appear as Nintendo's apps - if using nxapi as a library you will need to handle this yourself.

#### Do I need a Nintendo Switch Online membership?

No.

The only requirement to use this is that your Nintendo Account is linked to a Network Service Account, i.e. you've linked your Nintendo Account to a Nintendo Switch console at some point. It doesn't matter if your account is no longer linked to any console.

You will need to have had an online membership (free trial is ok) to use any game-specific services if you want to access those. SplatNet 2 can be used without an active membership, but NookLink and Smash World both require an active membership just to open them.

For Parental Controls data, you don't need to have linked your account to a console. You will need to use Nintendo's app to add a console to your account though, as this isn't supported in nxapi and the Parental Controls API is a bit useless without doing this.

#### Will my Nintendo Switch console be banned for using this?

No.

#### Will my Nintendo Account/Network Service Account be banned for using this?

It's extremely unlikely:

- Other projects (e.g. splatnet2statink, splatoon2.ink) have used the same reverse engineered APIs for a long time (pretty much since they've existed) and no one has ever been banned for using them. splatnet2statink in monitoring mode updates every 5 minutes by default - monitoring commands (Discord presence, friend notifications and SplatNet 2 monitoring) in nxapi only update slightly more frequently (every 1 minute), so there's not much higher risk than using splatnet2statink.
- Unlike console bans, account bans would prevent you from accessing digital content or online services you've paid for. (If your console was banned you'd still be able to use it and you could just buy another one to access your account.)
- Nintendo can't stop you watching their app's network activity, which is all the reverse engineering required to develop this.

For Discord Rich Presence, you can create an additional account, add your main account as a friend and use the `--friend-nsaid` option to avoid automating your main account. Once set up, you can remove the additional account from any console. You can also set up an API proxy server (with a HTTPS reverse proxy), authenticate using a separate account, and set up API proxy authentication tokens to allow up to 300 users (max. Nintendo Switch friends) to set up Discord Rich Presence (or, get their Nintendo Switch presence in a simple HTTP request to use for anything else) without any additional requests to Nintendo.

#### Why is a token sent to one/two different non-Nintendo servers?

It's required to generate some data to make Nintendo think you're using the real Nintendo Switch Online app. (This isn't required for Parental Controls data.) See the splatnet2statink and flapg section below for more information.

Currently it's too hard to do this locally. nxapi includes a service to do this using a rooted Android device/emulator. Hopefully at some point this will become easier.

This is really annoying. Initially the Nintendo Switch Online app didn't perform any sort of client attestation at all, then Nintendo added a HMAC of the id_token, timestamp and request ID to app/web service login requests, using a secret key embedded in the app, which was soon discovered. Nintendo later updated the app to use a native library (`libvoip`, which is also used for the app's VoIP features) to do this, and still no one knows how it works. (To make things even more confusing, the function, `genAudioH`/`genAudioH2`, always returns a different result, even when given the same inputs.)

The reason Nintendo added this is probably to try and stop people automating access to their app's API. I really hope that's wrong though, as then Nintendo would be prioritising that over account security, as most people seem ok with sharing account credentials to access the API. (And it's not stopping anyone accessing the API outside of the app anyway.)

### Electron app

nxapi includes an Electron menu bar app. Currently it can only be used by installing from source (there's no packaged version yet).

The app can currently be used to:

- Login to a Nintendo Account, both for the Nintendo Switch Online app and Parental Controls app.
    - This will open the Nintendo Account login page in the app, just like signing into Nintendo's own apps.
    - Accounts are shared with the nxapi command line interface.
- Share an authenticated Nintendo Account's presence to Discord.
    - Using a custom presence URL or a friend's presence is not supported.
    - Only one user can be selected - selecting another user will stop sharing the first user's presence.
- Showing notifications for an authenticated user/friend's presence.
    - Multiple users can be selected, but this doesn't work yet.
- Access game-specific services.
    - These will be opened in the app.

![Screenshot of the menu bar app open with SplatNet 2 and NookLink open in the background](resources/Screenshot%202022-04-17%20at%2023.56.08%202.png)

After installing nxapi from source the app can be run using this command:

```sh
nxapi app
```

This command has no options, but environment variables can still be used.

### Install

#### Install with npm

Node.js and npm must already be installed.

```sh
# From registry.npmjs.com
npm install --global nxapi

# From gitlab.fancy.org.uk
npm install --global --registry https://gitlab.fancy.org.uk/api/v4/packages/npm/ @samuel/nxapi

# From npm.pkg.github.com
npm install --global --registry https://npm.pkg.github.com @samuelthomas2774/nxapi
```

#### Install from source

Node.js and npm must already be installed.

```sh
git clone https://gitlab.fancy.org.uk/samuel/nxapi.git # or download as an archive
cd nxapi

# Install locally
npm install
npx tsc
npm link

# Build Docker image
docker build . --tag gitlab.fancy.org.uk:5005/samuel/nxapi
# # Run in Docker
# docker run -it --rm -v ./data:/data gitlab.fancy.org.uk:5005/samuel/nxapi ...
```

### Nintendo Switch Online

#### Login to the Nintendo Switch Online app

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

#### Discord Presence

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

#### Friend presence notifications

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

#### Friends

```sh
# Show Nintendo Switch friends in a table
nxapi nso friends

# JSON
nxapi nso friends --json
nxapi nso friends --json-pretty-print
```

#### Nintendo Switch Online app announcements/alerts

```sh
# Show app announcements in a table
nxapi nso announcements

# JSON
nxapi nso announcements --json
nxapi nso announcements --json-pretty-print
```

#### Web services/game-specific services

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

#### API proxy server

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
curl "http://[::1]:12345/api/znc/webservices?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/webservice/5741031244955648/token?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/activeevent?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/user?user=0123456789abcdef"
curl "http://[::1]:12345/api/znc/user/presence?user=0123456789abcdef"
curl --no-buffer "http://[::1]:12345/api/znc/presence/events?user=0123456789abcdef"
```

#### splatnet2statink and flapg

The splatnet2statink and flapg APIs are used by default to automate authenticating to the Nintendo Switch Online app's API and authenticating to web services. An access token (`id_token`) created by Nintendo must be sent to these APIs to generate some data that is required to authenticate the app. These APIs run the Nintendo Switch Online app in an Android emulator to generate this data. The access token sent includes some information about the authenticated Nintendo Account and can be used to authenticate to the Nintendo Switch Online app and web services.

Specifically, the tokens sent are JSON Web Tokens. The token sent to login to the app includes [this information and is valid for 15 minutes](https://gitlab.fancy.org.uk/samuel/nxapi/-/wikis/Nintendo-tokens#nintendo-account-id_token), and the token sent to login to web services includes [this information and is valid for two hours](https://gitlab.fancy.org.uk/samuel/nxapi/-/wikis/Nintendo-tokens#nintendo-switch-online-app-token).

Alternatively nxapi includes a custom server using Frida on an Android device/emulator that can be used instead of these.

This is only required for Nintendo Switch Online app data. Nintendo Switch Parental Controls data can be fetched without sending an access token to a third-party API.

### SplatNet 2

All SplatNet 2 commands may automatically request a web service token. This will involve the splatnet2statink and flapg APIs (or a custom server). This can be disabled by setting `--no-auto-update-session`, however this will cause commands to fail if there isn't a valid SplatNet 2 token.

#### User

```sh
# Show the authenticated SplatNet 2 user
nxapi splatnet2 user
```

#### Download user records

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

#### Download battle/Salmon Run results

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

#### Monitor SplatNet 2 for new user records/battle/Salmon Run results

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

### NookLink

All NookLink commands may automatically request a web service token. This will involve the splatnet2statink and flapg APIs (or a custom server). This can be disabled by setting `--no-auto-update-session`, however this will cause commands to fail if there isn't a valid NookLink token.

#### User

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
# --user can also be used to selecte a different Nintendo Account
nxapi nooklink user --user 0123456789abcdef
nxapi nooklink user --user 0123456789abcdef --islander 0x0123456789abcdef
```

#### Newspapers

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

#### Download newspapers

```sh
# Download all island newspapers to the nooklink directory in nxapi's data path
# Data that already exists will not be redownloaded
nxapi nooklink dump-newspapers

# Download all island newspapers to data/nooklink
nxapi nooklink dump-newspapers data/nooklink
```

#### Messages

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

### Nintendo Switch Parental Controls

#### Login to the Nintendo Switch Parental Controls app

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

#### Nintendo Switch consoles

```sh
# Show Nintendo Switch consoles in a table
nxapi pctl devices

# JSON
nxapi pctl devices --json
nxapi pctl devices --json-pretty-print
```

#### Daily summaries

```sh
# Show daily summary data in a table
# Use `nxapi pctl devices` to get the device ID
nxapi pctl daily-summaries 0123456789abcdef

# JSON
nxapi pctl daily-summaries 0123456789abcdef --json
nxapi pctl daily-summaries 0123456789abcdef --json-pretty-print
```

#### Monthly summaries

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

#### Download summary data

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

### Misc. commands/options

#### Users

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

#### Data location

Data will be stored in an OS-specific local data location by default in the `nxapi-nodejs` directory.

```sh
# Store data in ./data
nxapi --data-path ./data ...
NXAPI_DATA_PATH=`pwd`/data nxapi ...
```

#### Debug logs

Logging uses the `debug` package and can be controlled using the `DEBUG` environment variable. All nxapi logging uses the `api` and `cli` namespaces.

```sh
# Show all debug logs from nxapi
DEBUG=api,api:*,cli,cli:* nxapi ...

# Show all API requests
DEBUG=api:* nxapi ...

# Show all debug logs
DEBUG=* nxapi ...
```

#### znca API server

A server for controlling the Nintendo Switch Online app on an Android device/emulator using Frida can be used instead of the splatnet2statink and flapg APIs.

This requires:

- adb is installed on the computer running nxapi
- The Android device is running adbd as root or a su-like command can be used to escalate to root
- The frida-server executable is located at `/data/local/tmp/frida-server` on the Android device
- The Nintendo Switch Online app is installed on the Android device

The Android device must be constantly reachable using ADB. The server will exit if the device is unreachable.

```sh
# Start the server using the ADB server "android.local:5555" listening on all interfaces on a random port
nxapi android-znca-api-server-frida android.local:5555

# Start the server listening on a specific address/port
# The `--listen` option can be used multiple times
nxapi android-znca-api-server-frida android.local:5555 --listen "[::1]:12345"

# Use a command to escalate to root to start frida-server and the Nintendo Switch Online app
# "{cmd}" will be replaced with the path to a temporary script in double quotes
nxapi android-znca-api-server-frida android.local:5555 --exec-command "/system/bin/su -c {cmd}"

# Make API requests using curl
curl --header "Content-Type: application/json" --data '{"type": "nso", "token": "...", "timestamp": "...", "uuid": "..."}' "http://[::1]:12345/api/znca/f"

# Use the znca API server in other commands
# This should be set when running any nso commands as the access token will be refreshed automatically when it expires
ZNCA_API_URL=http://[::1]:12345/api/znca nxapi nso ...
```

#### .env file

Some options can be set using environment variables. These can be stored in a `.env` file in the data location. Environment variables will be read from the `.env` file in the default location, then the `.env` file in `NXAPI_DATA_PATH` location. `.env` files will not be read from the location set in the `--data-path` option.

### Links

- Nintendo Switch Online app API docs
    - https://github.com/ZekeSnider/NintendoSwitchRESTAPI
    - https://dev.to/mathewthe2/intro-to-nintendo-switch-rest-api-2cm7
- splatnet2statink and flapg docs
    - https://github.com/frozenpandaman/splatnet2statink/wiki/api-docs
- Disabling TLS certificate validation (entirely) with Frida on Android
    - https://httptoolkit.tech/blog/frida-certificate-pinning/
- Other Discord Rich Presence implementations (that use znc)
    - https://github.com/MCMi460/NSO-RPC
    - https://github.com/Quark064/NSO-Discord-Integration
    - https://github.com/AAGaming00/acnhrp - doesn't use znc, instead attempts to send a message in Animal Crossing: New Horizons every 10 seconds to check if the user is playing that game online
- Other projects using znc/web services
    - https://github.com/frozenpandaman/splatnet2statink
    - https://github.com/subnode/LoungeDesktop
    - https://github.com/dqn/gonso
    - https://github.com/clovervidia/splatnet-datagrabber
    - https://github.com/mizuyoukanao/ACNH_Chat_Client
    - https://github.com/dqn/acnh
    - ... plus many more - [search GitHub for https://elifessler.com/s2s/api/gen2](https://github.com/search?q=https%3A%2F%2Felifessler.com%2Fs2s%2Fapi%2Fgen2&type=code)
