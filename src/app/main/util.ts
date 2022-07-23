import { nativeImage } from './electron.js';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import fetch from 'node-fetch';
import { dir } from '../../util/product.js';

export const bundlepath = path.resolve(dir, 'dist', 'app', 'bundle');

export async function getNativeImageFromUrl(url: URL | string, useragent?: string) {
    const response = await fetch(url.toString(), {
        headers: {
            'User-Agent': useragent ?? '',
        },
    });
    const image = await response.arrayBuffer();
    return nativeImage.createFromBuffer(Buffer.from(image));
}

export async function tryGetNativeImageFromUrl(url: URL | string, useragent?: string) {
    try {
        return await getNativeImageFromUrl(url, useragent);
    } catch (err) {}

    return undefined;
}
