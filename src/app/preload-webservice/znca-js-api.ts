import createDebug from 'debug';
import ipc from './ipc.js';

const debug = createDebug('app:preload-webservice:znca-js-api');

// NookLink throws an error if restorePersistentData doesn't exist (and helpfully discards it somewhere)
// All others aren't required

declare global {
    interface Window {
        /**
         * window.invokeNativeShare(JSON.stringify({text: e.text, image_url: e.url, hashtags: e.hashtags}))
         */
        // SplatNet 2
        invokeNativeShare?: (data: string) => void;

        /**
         * window.invokeNativeShareUrl(JSON.stringify({url: '', text: ''}))
         */
        // Smash World
        invokeNativeShareUrl?: (data: string) => void;

        // NookLink
        requestGameWebToken?: () => void;
        onGameWebTokenReceive?: (token: string) => void;

        // NookLink
        restorePersistentData?: () => void;
        onPersistentDataRestore?: (data: string) => void;
        // NookLink
        storePersistentData?: (data: string) => void;
        onPersistentDataStore?: (data: string) => void;

        // NookLink
        openQRCodeReader?: (data: string) => void;
        // NookLink
        openQRCodeReaderFromPhotoLibrary?: (data: string) => void;
        onQRCodeRead?: (data: string) => void;
        // NookLink
        closeQRCodeReader?: () => void;
        // NookLink
        closeQRCodeReaderFromPhotoLibrary?: () => void;

        // Unused
        sendMessage?(data: string): void;
        // SplatNet 3
        copyToClipboard?(data: string): void;
        // SplatNet 3
        openQRCodeReaderForCheckin?(data: string): void;
        onQRCodeReadForCheckin?(data: string): void;
        // SplatNet 3
        downloadImages?(imagesJson: string): void;
        // SplatNet 3
        completeLoading?(): void;
        // SplatNet 3
        closeWebView?(): void;
        // SplatNet 3
        reloadExtension?(): void;
    }
}

//
// Share
//

export interface NativeShareRequest {
    text: string;
    image_url: string;
    hashtags: string[];
}

function invokeNativeShare(data: string) {
    debug('invokeNativeShare called', data);

    ipc.invokeNativeShare(data);
}

export interface NativeShareUrlRequest {
    url: string;
    text: string;
}

function invokeNativeShareUrl(data: string) {
    debug('invokeNativeShareUrl called', data);

    ipc.invokeNativeShareUrl(data);
}

window.invokeNativeShare = invokeNativeShare;
window.invokeNativeShareUrl = invokeNativeShareUrl;

//
// Web service token
//

function requestGameWebToken() {
    debug('requestGameWebToken called');

    ipc.requestGameWebToken().then(token => {
        window.onGameWebTokenReceive?.call(null, token);
    }).catch(async err => {
        debug('Error requesting web service token', err);
    });
}

window.requestGameWebToken = requestGameWebToken;

//
// Persistent data
//

function restorePersistentData() {
    debug('restorePersistentData called');

    ipc.restorePersistentData().then(data => {
        window.onPersistentDataRestore?.call(null, data ?? '');
    });
}

function storePersistentData(data: string) {
    debug('storePersistentData called', data);

    ipc.storePersistentData(data).then(() => {
        window.onPersistentDataStore?.call(null, '');
    });
}

window.restorePersistentData = restorePersistentData;
window.storePersistentData = storePersistentData;

//
// QR code scanner
//

function openQrCodeReader(data: string) {
    debug('openQRCodeReader called', data);

    Promise.resolve().then(() => {
        const base64EncodeText = '';
        window.onQRCodeRead?.call(null, base64EncodeText);
    });
}
function closeQrCodeReader() {
    //
}

function openQrCodeReaderFromPhotoLibrary(data: string) {
    debug('openQRCodeReaderFromPhotoLibrary called', data);

    Promise.resolve().then(() => {
        const base64EncodeText = '';
        window.onQRCodeRead?.call(null, base64EncodeText);
    });
}
function closeQrCodeReaderFromPhotoLibrary() {
    //
}

function openQRCodeReaderForCheckin(data: string) {
    //

    Promise.resolve().then(() => {
        const base64EncodeText = '';
        window.onQRCodeReadForCheckin?.call(null, base64EncodeText);
    });
}

window.openQRCodeReader = openQrCodeReader;
window.openQRCodeReaderFromPhotoLibrary = openQrCodeReaderFromPhotoLibrary;
window.closeQRCodeReader = closeQrCodeReader;
window.closeQRCodeReaderFromPhotoLibrary = closeQrCodeReaderFromPhotoLibrary;
window.openQRCodeReaderForCheckin = openQRCodeReaderForCheckin;

//
// Other
//

function sendMessage(data: string) {
    //
    debug('sendMessage called', data);
}

function copyToClipboard(data: string) {
    //
    debug('copyToClipboard called', data);
}

function downloadImages(imagesJson: string) {
    debug('downloadImages called', imagesJson);
}

function completeLoading() {
    ipc.completeLoading();
}

function closeWebView() {
    window.close();
}

function reloadExtension() {
    debug('reloadExtension called');
}

window.sendMessage = sendMessage;
window.copyToClipboard = copyToClipboard;
window.downloadImages = downloadImages;
window.completeLoading = completeLoading;
window.closeWebView = closeWebView;
window.reloadExtension = reloadExtension;
