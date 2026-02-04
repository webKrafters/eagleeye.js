import type {
    Changes as BaseChanges,
    Immutable as AutoImmutable,
    Value
} from '@webkrafters/auto-immutable';

import { FULL_STATE_SELECTOR } from './constants';

import { createEagleEye, LiveStore } from './main';

export type {
    BaseType,
    ClearCommand,
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

export type SelectorMap = ObjectSelector | ArraySelector | void;

type ReplacePathSeps<
    P extends Text,
    T extends string,
> = P extends `${infer U}${T}${infer V}`
    ? ReplacePathSeps<`${U}.${V}`, T>
    : P;

type TrimPathSep<P extends Text> = P extends `${infer U}]${never}` ? U : P;

type NormalizePath<P extends Text> = TrimPathSep<
    ReplacePathSeps<
        ReplacePathSeps<
            ReplacePathSeps<
                P,
                ']['
            >,
            '].'
        >,
        '['
    >
>;

type Datum<
    P extends Text,
    S extends Record<Text, any> = State
> = P extends `${infer K}.${infer P_1}`
    ? Datum<P_1, S[K]>
    : P extends ''
    ? S
    : any;

type DataPoint<
    P extends Text,
    S extends State
> = P extends FullStateSelector ? S : Datum<NormalizePath<P>, S>;

export type Data<
    SELECTOR_MAP extends SelectorMap,
    STATE extends State = State
> = (
    SELECTOR_MAP extends ObjectSelector
    ? {[ S_KEY in keyof SELECTOR_MAP ] : DataPoint<SELECTOR_MAP[S_KEY], STATE> }
    : SELECTOR_MAP extends ArraySelector
    ? {[ S_NUM : number ] : DataPoint<SELECTOR_MAP[number], STATE>}
    : Array<any>
);

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

export const enum StoreShutdownReason {
	LOCAL = 'USER LOCALLY INITIATED SHUTDOWN',
	REMOTE = 'REMOTE CACHE SHUTDOWN'
};

export interface IStore<T extends State = State> {
    resetState : (propertyPaths?: Array<string>) => void;
    setState : (changes: Changes<T>) => void;
}

export interface Store<
    T extends State = State,
    SELECTOR_MAP extends SelectorMap = SelectorMap
> extends IStore<T> {
    data : Data<SELECTOR_MAP>;
};

export interface StoreRef<T extends State = State> extends IStore<T>{
    getState : (propertyPaths?: Array<string>) => T,
    subscribe : (listener : Listener) => Unsubscribe;
}

export interface BaseStream<T extends State = State>{
	<S extends SelectorMap>(selectorMap?: S) : LiveStore<T, S>;
}

export interface Stream<T extends State = State> extends BaseStream<T>{
	<S extends SelectorMap>(selectorMap?: S) : Store<T, S>;
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
    createEagleEye,
    EagleEyeContext,
    LiveStore
} from './main';

export default createEagleEye;
