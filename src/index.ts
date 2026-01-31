import type {
    Changes as BaseChanges,
    Immutable as AutoImmutable,
    Value
} from '@webkrafters/auto-immutable';

import { FULL_STATE_SELECTOR } from './constants';

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

export interface IStorage<T extends State = State> {
    clone: (data: T) => T;
    getItem: (key: string) => T;
    removeItem: (key: string) => void;
    setItem: (key: string, data: T) => void;
};

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

export { createContext } from './main';
