import type {
    Changes as BaseChanges,
    Immutable as AutoImmutable,
    Value
} from '@webkrafters/auto-immutable';

import { FULL_STATE_SELECTOR } from './constants';

import { createEagleEye, Channel } from './main';

export type {
    BaseType,
    ClearCommand,
    Immutable as AutoImmutable,
    KeyType,
    MoveCommand,
    PushCommand,
    ReplaceCommand,
    SetCommand,
    SpliceCommand,
    TagCommand,
    TagType,
    UpdateStats,
    UpdatePayload,
    UpdatePayloadArray
} from '@webkrafters/auto-immutable';

export type State = Value;

export type ShutdownMonitor = (reason : ShutdownReason) => void

export type Listener = <T extends State>(
    changes : Changes<T>,
    changedPathsTokens : Readonly<Array<Array<string>>>,
    netChanges : Readonly<T>,
    mayHaveChangesAt : (pathTokens : Array<string>) => boolean
) => void;

export interface ContextInfra<T extends State> {
    prehooks?: Prehooks<T>;
    storage?: IStorage<T>;
}

export interface RawProviderProps<T extends State> extends ContextInfra<T> {
    value?: T;
};

export interface ProviderProps<T extends State> extends ContextInfra<T> {
    value?: AutoImmutable<T>;
};

export type Text = string | number;

export type FullStateSelector = typeof FULL_STATE_SELECTOR;

export type ObjectSelector = Record<Text, Text | FullStateSelector>;

export type ArraySelector = Array<Text | FullStateSelector>;

export type SelectorMap = ObjectSelector | ArraySelector | undefined | null;

// =====

type Replace<
  P extends string,
  S extends string,
  R extends string
> = P extends `${infer K}${S}${infer PP}`
  ? `${K}${R}${Replace<PP, S, R>}`
  : P;

type DotizedPath<
  P extends string
> = Replace<Replace<Replace<Replace<P, ']', '.'>, '[', '.'>, '..', '.'>, '...', '.'>;

type DrillType<
  T extends Record<any, any>,
  P extends string,
  W extends State
> = P extends `${infer K}.${infer R}`
    ? T[K] extends {}
        ? DrillType<T[K], R, W>
        : any
    : P extends FullStateSelector
    ? W
    : T[P];

type ExtricateTypeFrom<
  T extends State,
  P extends string
> = DrillType<T, DotizedPath<P>, T>;

export type Data<
  S extends SelectorMap = SelectorMap,
  T extends State = State
> = S extends undefined|null
    ? {}
    : S extends ObjectSelector
        ? {
            [K in keyof S]: S[K] extends string
            ? ExtricateTypeFrom<T, S[K]>
            : S[K] extends keyof T
            ? T[S[K]]
            : any
        }
        : S extends Array<infer U>
            ? U extends FullStateSelector
                ? Record<number, T>
                : Record<number, any>
            : Record<any, any>;

export type Changes<T extends State = State> = BaseChanges<T>;

interface StorageGetter<T extends State = State>{
    (key : null) : T;
    (key : string) : T;
}

interface StorageDeleteFn{
    (key : null) : void;
    (key : string) : void;
}

interface StorageSetter<T extends State = State>{
    (key: null, data: T) : void;
    (key: string, data: T) : void;
}

export interface IStorage<T extends State = State> {
    clone: (data: T) => T;
    getItem: StorageGetter<T>;
    removeItem: StorageDeleteFn;
    setItem: StorageSetter<T>;
};

export interface CurrentStorage<T extends State> extends IStorage<T> {
	isKeyRequired? : boolean; // required for shared storage API such as localstorage
}

export interface Prehooks<T extends State = State> {
    resetState?: (
        resetData: Partial<T>,
        state: {
            current: T;
            original: T;
        }
    ) => boolean;
    setState?: (newChanges: Changes<T>) => boolean;
};

export type Unsubscribe = (...args: Array<unknown>) => void;

export const enum Phase {
	UN_OPENED = -1,
	CLOSED = 0,
	OPENED = 1,
	CLOSING = 2
};

export const enum ShutdownReason {
	CACHE = 'CACHE DATA SHUTDOWN',
    CONTEXT = 'CONTEXT-WIDE SHUTDOWN',
	LOCAL = 'CURRENT STORE INITIATED SHUTDOWN'
};

export interface IStore<T extends State = State> {
    resetState : (propertyPaths?: Array<string>) => void;
    setState : (changes: Changes<T>) => void;
}

export interface Store<
    T extends State = State,
    SELECTOR_MAP extends SelectorMap = SelectorMap
> extends IStore<T> {
    data : Data<SELECTOR_MAP, T>;
};

export interface StoreRef<T extends State = State> extends IStore<T>{
    getState : (propertyPaths?: Array<string>) => T;
    subscribe : {
        (eventType: "closing", listener: ShutdownMonitor) : Unsubscribe;
        (eventType: "data-updated", listener: Listener) : Unsubscribe;
    }
}

export interface StoreInternal<T extends State = State> extends StoreRef<T>{
    close : () => void;
    closed : boolean;
}

export interface BaseStream<T extends State = State>{
	<const S extends SelectorMap>(selectorMap? : S) : Channel<T, S>;
};

export interface Stream<T extends State = State> extends BaseStream<T>{
	<const S extends SelectorMap>(selectorMap?: S) : Store<T, S>;
}

export {
    CLEAR_TAG,
    DELETE_TAG,
    FULL_STATE_SELECTOR,
    MOVE_TAG,
    NULL_SELECTOR,
    PUSH_TAG,
    REPLACE_TAG,
    SET_TAG,
    SPLICE_TAG,
    Tag,
} from './constants';

export {
    Channel,
    createEagleEye,
    EagleEyeContext
} from './main';

export default createEagleEye;
