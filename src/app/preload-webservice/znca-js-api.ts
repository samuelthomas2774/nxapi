import createDebug from 'debug';
import ipc from './ipc.js';

const debug = createDebug('app:preload-webservice:znca-js-api');

// NookLink throws an error if restorePersistentData doesn't exist (and helpfully discards it somewhere)
// All others aren't required

declare global {
    interface Window extends Partial<WebServiceJsApi> {
        jsBridge?: WebServiceJsApi;

        onGameWebTokenReceive?: (token: string) => void;
        onPersistentDataRestore?: (data: string) => void;
        onPersistentDataStore?: (data: string) => void;
        onQRCodeRead?: (data: string) => void;
        onQRCodeReadForCheckin?(data: string): void;
    }
}

interface WebServiceJsApi {
    /**
     * Downloads an image and opens the native share menu.
     *
     * Used by SplatNet 2.
     *
     * Called as:
     *
     * ```js
     * window.invokeNativeShare(JSON.stringify({text: e.text, image_url: e.url, hashtags: e.hashtags}))
     * ```
     */
    invokeNativeShare(data: string): void;
    /**
     * Opens the native share menu.
     *
     * Used by Smash World.
     *
     * ```js
     * window.invokeNativeShareUrl(JSON.stringify({url: '', text: ''}))
     * ```
     */
    invokeNativeShareUrl(data: string): void;

    /**
     * Requests a web service token from the Coral API.
     * `window.onGameWebTokenReceive` is called with the returned token.
     *
     * Used by NookLink and SplatNet 3.
     */
    requestGameWebToken(): void;

    /**
     * Load persistent data for this web service.
     * `window.onPersistentDataRestore` is called with the stored data.
     *
     * Used by NookLink.
     */
    restorePersistentData(): void;
    /**
     * Store persistent data for this web service.
     * `window.onPersistentDataStore` is called when complete.
     *
     * Used by NookLink.
     */
    storePersistentData(data: string): void;

    /**
     * Open the QR code reader.
     * `window.onQRCodeRead` is called with the base64-encoded result.
     *
     * Used by NookLink.
     */
    openQRCodeReader(data: string): void;
    /**
     * Open the QR code reader.
     * `window.onQRCodeRead` is called with the base64-encoded result.
     *
     * Used by NookLink.
     */
    openQRCodeReaderFromPhotoLibrary(data: string): void;
    /**
     * Close the QR code reader.
     *
     * Used by NookLink.
     */
    closeQRCodeReader(): void;
    /**
     * Close the QR code reader.
     *
     * Used by NookLink.
     */
    closeQRCodeReaderFromPhotoLibrary(): void;

    /**
     * Send a message to the app's main thread.
     * This is used to show native message dialogs and control the QR code reader.
     *
     * Used by NookLink.
     */
    sendMessage(data: string): void;

    /**
     * Writes text to the clipboard.
     *
     * Used by SplatNet 3.
     */
    copyToClipboard(data: string): void;

    /**
     * Opens the QR code reader.
     * `window.onQRCodeReadForCheckin` is called with a JSON document containing the result.
     *
     * Used by SplatNet 3.
     */
    openQRCodeReaderForCheckin(data: string): void;

    /**
     * Download images and save them to the photo library.
     *
     * Used by SplatNet 3.
     */
    downloadImages(imagesJson: string): void;

    /**
     * Report the web service is ready to show and hide the loading screen.
     * Web services that set the `fullScreen` attribute to `true` must call this.
     *
     * Used by SplatNet 3.
     */
    completeLoading(): void;
    /**
     * Closes the web service.
     * Web services that set the `fullScreen` attribute to `true` must have a button that calls this.
     *
     * Used by SplatNet 3.
     */
    closeWebView(): void;
    /**
     * Asks the OS to reload any native widget extensions.
     *
     * Used by SplatNet 3.
     */
    reloadExtension(): void;

    /**
     * Clears the unread notifications flag.
     */
    clearUnreadFlag(): void;

    /**
     * Opens a URL in the default browser.
     */
    openExternalBrowser(url: string): void;

    /**
     * Plays a preset vibration pattern.
     *
     * Used by ZELDA NOTES.
     */
    func_2644(data: string): void;

    /**
     * Requests a web service token from the Coral API.
     * `window.znca._private.func_1d5e` is called with the returned token.
     *
     * Used by ZELDA NOTES.
     */
    func_272e(): void;
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

function func_272e() {
    debug('func_272e called');

    ipc.requestGameWebToken().then(token => {
        // @ts-expect-error
        window.znca?._private?.func_1d5e?.call(null, token);
    }).catch(async err => {
        debug('Error requesting web service token', err);
    });
}

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

//
// QR code scanner
//

export interface QrCodeReaderCameraOptions {
    messageResources: {
        Camera_Page_Title: string;
        Camera_Label_WaitingCameraPermission: string;
        Camera_Label_WaitingCameraPermissionDescription: string;
        Camera_Label_ChangeSetting: string;
        Camera_Label_Searching: string;
        Camera_Label_ProDialog1stQRCode: string;
        Camera_Label_ProDialog1stQRCodeDescription: string;
        Camera_Label_Pro2ndQRCodeRead: string;
        Camera_Label_Pro3rdQRCodeRead: string;
        Camera_Label_Pro4thQRCodeRead: string;
        Cmn_Dialog_Button_Ok: string;
        Cmn_Dialog_Button_Close: string;
    };
}
export interface QrCodeReaderPhotoLibraryOptions {
    messageResources: {
        PhotoLibrary_Page_Title: string;
        PhotoLibrary_Label_WaitingPhotoLibraryPermission: string;
        PhotoLibrary_Label_WaitingPhotoLibraryPermissionDescription: string;
        PhotoLibrary_Label_ChangeSetting: string;
        PhotoLibrary_Label_Header: string;
        PhotoLibrary_Label_Notice: string;
        PhotoLibrary_Label_SelectPhoto: string;
        PhotoLibrary_Label_ProDialog1stQRCode: string;
        PhotoLibrary_Label_ProDialog1stQRCodeDescription: string;
        PhotoLibrary_Label_Pro2ndQRCodeRead: string;
        PhotoLibrary_Label_Pro3rdQRCodeRead: string;
        PhotoLibrary_Label_Pro4thQRCodeRead: string;
        Cmn_Dialog_Button_Ok: string;
        Cmn_Dialog_Button_Close: string;
        Error_Dialog_Message_Multiple_Error: string;
        Error_Dialog_Message_Unknown_Error: string;
    };
}

function openQrCodeReader(/** JSON.stringify(data: QrCodeReaderCameraOptions) */ data: string) {
    debug('openQRCodeReader called', data);

    ipc.openQrCodeReader({
        type: 'camera',
        data,
    }).then(result => {
        const base64EncodeText = result;
        window.onQRCodeRead?.call(null, base64EncodeText);
    });
}
function closeQrCodeReader() {
    ipc.closeQrCodeReader();
}

function openQrCodeReaderFromPhotoLibrary(/** JSON.stringify(data: QrCodeReaderPhotoLibraryOptions) */ data: string) {
    debug('openQRCodeReaderFromPhotoLibrary called', data);

    ipc.openQrCodeReader({
        type: 'photolibrary',
        data,
    }).then(result => {
        const base64EncodeText = result;
        window.onQRCodeRead?.call(null, base64EncodeText);
    });
}
function closeQrCodeReaderFromPhotoLibrary() {
    ipc.closeQrCodeReader();
}

export interface QrCodeReaderCheckinOptions {
    source: 'camera' | 'photo_library';
}
export type QrCodeReaderCheckinResult = {
    status: 'SUCCEEDED';
    /** base64 encoded data */
    text: string;
} | {
    status: 'CANCELLED' | 'ERROR';
    text: null;
};

function openQRCodeReaderForCheckin(/** JSON.stringify(data: QrCodeReaderCheckinOptions) */ data: string) {
    debug('openQRCodeReaderForCheckin called', data);

    ipc.openQrCodeReader({
        type: 'checkin',
        data,
    }).then(result => {
        window.onQRCodeReadForCheckin?.call(null, result);
    });
}

//
// Other
//

export interface SendMessageOptions {
    type: 'B_SHOW_SUCCESS' | 'B_SHOW_ERROR' | 'B_SET_INDEX';
    message: string;
}

function sendMessage(/** JSON.stringify(data: SendMessageOptions) */ data: string) {
    debug('sendMessage called', data);
    ipc.sendMessage(data);
}

function copyToClipboard(data: string) {
    debug('copyToClipboard called', data);
    ipc.copyToClipboard(data);
}

export interface DownloadImagesRequest {
    image_urls: string[];
}

function downloadImages(/** JSON.stringify(data: DownloadImagesRequest) */ imagesJson: string) {
    debug('downloadImages called', imagesJson);
    ipc.downloadImages(imagesJson);
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

function clearUnreadFlag() {
    debug('clearUnreadFlag called');
    ipc.clearUnreadFlag();
}

function openExternalBrowser(url: string) {
    debug('openExternalBrowser called', url);
    window.open(url);
}

export interface VibrateOptions {
    pattern: VibratePattern;
}
export enum VibratePattern {
    TAP = '0',
    SUCCESS = '1',
    ERROR = '2',
}

function func_2644(/** JSON.stringify(data: VibrateOptions) */ data: string) {
    const options: VibrateOptions = JSON.parse(data);

    debug('func_2644 called', options);
}

const api: WebServiceJsApi = {
    invokeNativeShare,
    invokeNativeShareUrl,
    requestGameWebToken,
    restorePersistentData,
    storePersistentData,
    openQRCodeReader: openQrCodeReader,
    closeQRCodeReader: closeQrCodeReader,
    openQRCodeReaderFromPhotoLibrary: openQrCodeReaderFromPhotoLibrary,
    closeQRCodeReaderFromPhotoLibrary: closeQrCodeReaderFromPhotoLibrary,
    sendMessage,
    copyToClipboard,
    openQRCodeReaderForCheckin: openQRCodeReaderForCheckin,
    downloadImages,
    completeLoading,
    closeWebView,
    reloadExtension,
    clearUnreadFlag,
    openExternalBrowser,
    func_2644,
    func_272e,
};

window.jsBridge = api;
Object.assign(window, api);
