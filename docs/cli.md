
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

SplatNet 3
---

All SplatNet 3 commands may automatically request a web service token. This will involve the imink/flapg API (or a custom server). This can be disabled by setting `--no-auto-update-session`, however this will cause commands to fail if there isn't a valid SplatNet 3 token.

### User

```sh
# Show the authenticated SplatNet 3 user
nxapi splatnet3 user
```

### Download history/hero/catalog records and stage/weapon stats

```sh
# Download user records to the splatnet3 directory in nxapi's data path
nxapi splatnet3 dump-records
# Download user records to data/splatnet3
nxapi splatnet3 dump-records data/splatnet3

# Only download history records
nxapi splatnet3 dump-records --history
# Only download hero records
nxapi splatnet3 dump-records --hero
# Only download catalog records
nxapi splatnet3 dump-records --catalog
# Only download stage stats
nxapi splatnet3 dump-records --stage
# Only download weapon stats
nxapi splatnet3 dump-records --weapon
```

### Download Splatfest records

```sh
# Download Splatfest records to the splatnet3 directory in nxapi's data path
nxapi splatnet3 dump-fests
# Download Splatfest records to data/splatnet3
nxapi splatnet3 dump-fests data/splatnet3

# Include rankings
nxapi splatnet3 dump-fests --include-rankings
```

### Download photo album items

```sh
# Download photos to the splatnet3 directory in nxapi's data path
nxapi splatnet3 dump-album
# Download photos to data/splatnet3
nxapi splatnet3 dump-album data/splatnet3
```

### Download history/hero/catalog records and stage/weapon stats

```sh
# Download user records to the splatnet3 directory in nxapi's data path
nxapi splatnet3 dump-records
# Download user records to data/splatnet3
nxapi splatnet3 dump-records data/splatnet3

# Only download history records
nxapi splatnet3 dump-records --history
# Only download hero records
nxapi splatnet3 dump-records --hero
# Only download catalog records
nxapi splatnet3 dump-records --catalog
# Only download stage stats
nxapi splatnet3 dump-records --stage
# Only download weapon stats
nxapi splatnet3 dump-records --weapon
```

### Download battle/Salmon Run results

```sh
# Download battle and Salmon Run results to the splatnet3 directory in nxapi's data path
# Data that already exists will not be redownloaded
nxapi splatnet3 dump-results
# Download battle and Salmon Run results to data/splatnet3
nxapi splatnet3 dump-results data/splatnet3

# Only download battle results
nxapi splatnet3 dump-results --battles
# Only download Salmon Run results
nxapi splatnet3 dump-results --coop

# Additionally download history records
nxapi splatnet3 dump-results --include-history
# Additionally download catalog records
nxapi splatnet3 dump-results --include-catalog
```

### Monitor SplatNet 3 for new user records/battle/Salmon Run results

This will constantly check SplatNet 3 for new data.

```sh
# Watch for new battle and Salmon Run results and photo album items and download them
# to the splatnet3 directory in nxapi's data path
nxapi splatnet3 monitor

# Watch for new battle and Salmon Run results and download them to data/splatnet3
nxapi splatnet3 monitor data/splatnet3

# Download history records when new battle/coop results are available
nxapi splatnet3 monitor --include-history
# Download catalog records when new battle/coop results are available
nxapi splatnet3 monitor --include-catalog
# Download stage stats when new battle results are available
nxapi splatnet3 monitor --include-stage
# Download weapon stats when new battle results are available
nxapi splatnet3 monitor --include-weapon

# Only monitor battle results
nxapi splatnet3 monitor --battles
# Only monitor Salmon Run results
nxapi splatnet3 monitor --coop
# Only monitor photo album items
nxapi splatnet3 monitor --album

# Set update interval to 1800 seconds (30 minutes)
nxapi splatnet3 monitor --update-interval 1800
```

### Friends

```sh
# Show Nintendo Switch friends who have played Splatoon 3 in a table
# This shows more information about in-game activities than `nxapi nso friends`
# Friends that are online and selected in a game will appear as online, even if they are not playing Splatoon 3
nxapi splatnet3 friends

# JSON
nxapi splatnet3 friends --json
nxapi splatnet3 friends --json-pretty-print
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

Presence server
---

nxapi includes a HTTP server for fetching presence data from Coral and SplatNet 3.

```sh
# Start the server listening on all interfaces on a random port
# The `--user` option is required and can be used multiple times
nxapi presence-server --user 0123456789abcdef

# Start the server listening on a specific address/port
# The `--listen` option can be used multiple times
nxapi presence-server --listen "[::1]:12345" --user 0123456789abcdef

# Enable Splatoon 3 presence data using SplatNet 3
# All users specified with the `--user` option must be able to access SplatNet 3
nxapi presence-server --user 0123456789abcdef --splatnet3

# Allow returning presence data for all users at `/api/presence`
nxapi presence-server --user 0123456789abcdef --allow-all-users

# Set the update interval to 5 minutes (300 seconds)
nxapi presence-server --user 0123456789abcdef --update-interval 300
```

```sh
# Fetch all available presence data using curl (requires the `--allow-all-users` option)
curl http://[::1]:12345/api/presence

# Fetch presence data for a specific user using curl
# Replace `0123456789abcdef` with the user's NSA ID
curl http://[::1]:12345/api/presence/0123456789abcdef
# Fetch presence data for a specific user including Splatoon 3 presence using curl
curl http://[::1]:12345/api/presence/0123456789abcdef?include-splatoon3=1

# Fetch Splatoon 3 fest voting history for a specific user using curl
curl http://[::1]:12345/api/presence/0123456789abcdef/splatoon3-fest-votes
# Fetch Splatoon 3 fest voting history including all prevotes for a specific user using curl
curl http://[::1]:12345/api/presence/0123456789abcdef/splatoon3-fest-votes?include-all=1

# Watch for presence events
curl --no-buffer http://[::1]:12345/api/presence/0123456789abcdef/events
curl --no-buffer http://[::1]:12345/api/presence/0123456789abcdef/events?include-splatoon3=1

# Save a user's current picture
curl -L http://[::1]:12345/api/presence/0123456789abcdef/image > image.jpeg

# Show the Nintendo eShop page for a user's current title
#   http://[::1]:12345/api/presence/0123456789abcdef/title/redirect
# Redirect to a friend code URL if not playing
#   http://[::1]:12345/api/presence/0123456789abcdef/title/redirect?friend-code=0000-0000-0000&friend-code-hash=0000000000
# Redirect to another URL if not playing
#   http://[::1]:12345/api/presence/0123456789abcdef/title/redirect?fallback-url=https://example.com
# Signal to the browser to cancel navigation if not playing
#   http://[::1]:12345/api/presence/0123456789abcdef/title/redirect?fallback-prevent-navigation=1

# Generate an SVG showing a user's presence
curl http://[::1]:12345/api/presence/0123456789abcdef/embed > embed.svg
# Generate a PNG/JPEG/WEBP showing a user's presence
curl http://[::1]:12345/api/presence/0123456789abcdef/embed.png > embed.png
curl http://[::1]:12345/api/presence/0123456789abcdef/embed.jpeg > embed.jpeg
curl http://[::1]:12345/api/presence/0123456789abcdef/embed.webp > embed.webp
# ... using a specific theme
curl http://[::1]:12345/api/presence/0123456789abcdef/embed?theme=light > embed.svg
curl http://[::1]:12345/api/presence/0123456789abcdef/embed?theme=dark > embed.svg
# ... including a friend code
curl http://[::1]:12345/api/presence/0123456789abcdef/embed?friend-code=0000-0000-0000 > embed.svg
# ... without a background and border
curl http://[::1]:12345/api/presence/0123456789abcdef/embed?transparent=1 > embed.svg
# ... with a custom width (500 to 1500, or 440 to 1440 with transparency)
curl http://[::1]:12345/api/presence/0123456789abcdef/embed?width=800 > embed.svg
# ... with Splatoon 3 presence
curl http://[::1]:12345/api/presence/0123456789abcdef/embed?include-splatoon3=1 > embed.svg
# ... with Splatoon 3 Splatfest team
curl 'http://[::1]:12345/api/presence/0123456789abcdef/embed?include-splatoon3=1&show-splatoon3-fest-team=1' > embed.svg
```

Example EventStream use:

```ts
const events = new EventSource('https://[::1]:12345/api/presence/0123456789abcdef/events');

events.addEventListener('close', event => {
    console.error('Event stream closed', event);
    // Handle reconnecting to the server...
});

events.addEventListener('friend', event => {
    const data = JSON.parse(event.data);
    console.log('Received Coral presence data', data.presence);
});
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

This is now a separate project at https://gitlab.fancy.org.uk/samuel/nxapi-znca-api or https://github.com/samuelthomas2774/nxapi-znca-api.
