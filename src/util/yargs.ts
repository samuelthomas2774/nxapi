import * as yargs from 'yargs';

//
// Yargs types
//

export type YargsArguments<T extends yargs.Argv> = T extends yargs.Argv<infer R> ? R : any;
export type Argv<T = {}> = yargs.Argv<T>;
// export type ArgumentsCamelCase<T = {}> = yargstypes.ArgumentsCamelCase<T>;

/** Convert literal string types like 'foo-bar' to 'FooBar' */
type PascalCase<S extends string> = string extends S ?
    string : S extends `${infer T}-${infer U}` ?
    `${Capitalize<T>}${PascalCase<U>}` : Capitalize<S>;

/** Convert literal string types like 'foo-bar' to 'fooBar' */
type CamelCase<S extends string> = string extends S ?
    string : S extends `${infer T}-${infer U}` ?
    `${T}${PascalCase<U>}` : S;

/** Convert literal string types like 'foo-bar' to 'fooBar', allowing all `PropertyKey` types */
type CamelCaseKey<K extends PropertyKey> = K extends string ? Exclude<CamelCase<K>, ''> : K;

/** Arguments type, with camelcased keys */
export type ArgumentsCamelCase<T = {}> = { [key in keyof T as key | CamelCaseKey<key>]: T[key] } & {
    /** Non-option arguments */
    _: Array<string | number>;
    /** The script name or node command */
    $0: string;
    /** All remaining options */
    [argName: string]: unknown;
};
