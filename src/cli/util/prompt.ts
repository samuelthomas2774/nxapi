import process from 'node:process';
import { promisify } from 'node:util';
import { Options } from 'read';

export default async function prompt(options: Options) {
    const read = await import('read');
    const prompt = promisify(read.default);

    return await prompt({
        output: process.stderr,
        ...options,
    });
}

export {
    Options,
};
