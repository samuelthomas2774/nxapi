nxapi
===

Access the Nintendo Switch Online and Nintendo Switch Parental Controls app APIs. Includes Discord Rich Presence and friend notifications.

### Install

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
nxapi nso presence --friend-naid 0123456789abcdef

# Show the authenticated user's friend code in Discord
nxapi nso presence --friend-code
nxapi nso presence --friend-code -

# Show a custom friend code in Discord
# Use this if you are showing presence of a friend of the authenticated user
nxapi nso presence --friend-code 0000-0000-0000
nxapi nso presence --friend-code SW-0000-0000-0000

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

# Start the server using another API proxy server
nxapi nso http-server --znc-proxy-url "http://[::1]:12345/api/znc"

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

Alternatively nxapi includes a custom server using Frida on an Android device/emulator that can be used instead of these.

This is only required for Nintendo Switch Online app data. Nintendo Switch Parental Controls data can be fetched without sending an access token to a third-party API.

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
# Download all daily and monthly summary data from all devices to ./summaries
# Data that already exists will not be redownloaded
nxapi pctl dump-summaries ./summaries

# Download all daily and monthly summary data from a specific device to ./summaries
# Use `nxapi pctl devices` to get the device ID
# The `--device` option can be used multiple times
nxapi pctl dump-summaries summaries --device 0123456789abcdef
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

### Links

- Nintendo Switch Online app API docs
    - https://github.com/ZekeSnider/NintendoSwitchRESTAPI
    - https://dev.to/mathewthe2/intro-to-nintendo-switch-rest-api-2cm7
- splatnet2statink and flapg docs
    - https://github.com/frozenpandaman/splatnet2statink/wiki/api-docs
- Disabling TLS certificate validation (entirely) with Frida on Android
    - https://httptoolkit.tech/blog/frida-certificate-pinning/
