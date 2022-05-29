import { nativeImage } from './electron.js';
import { Buffer } from 'buffer';
import fetch from 'node-fetch';

export async function getNativeImageFromUrl(url: URL | string) {
    const response = await fetch(url.toString());
    const image = await response.arrayBuffer();
    return nativeImage.createFromBuffer(Buffer.from(image));
}

export async function tryGetNativeImageFromUrl(url: URL | string) {
    try {
        return await getNativeImageFromUrl(url);
    } catch (err) {}

    return undefined;
}
