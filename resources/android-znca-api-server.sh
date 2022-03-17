#!/system/bin/sh

# Ensure frida-server is running
echo "Running frida-server"
killall frida-server
nohup /data/local/tmp/frida-server >/dev/null 2>&1 &

if [ "$?" != "0" ]; then
    echo "Failed to start frida-server"
    exit 1
fi

sleep 1

# Ensure the app is running
echo "Starting com.nintendo.znca"
am start-foreground-service com.nintendo.znca/com.google.firebase.messaging.FirebaseMessagingService
am start-service com.nintendo.znca/com.google.firebase.messaging.FirebaseMessagingService

if [ "$?" != "0" ]; then
    echo "Failed to start com.nintendo.znca"
    exit 1
fi

echo "Acquiring wake lock"
echo androidzncaapiserver > /sys/power/wake_lock
