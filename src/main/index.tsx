export interface ConnectProps<
	T extends State = State,
	S extends SelectorMap = SelectorMap
> {
	store : Store<T, S>
}

export type OwnPropsOf<P extends {}> = Omit<P, 'store'>;

export interface CurrentStorage<T extends State> extends IStorage<T> {
	isKeyRequired? : boolean
}

export interface Stream<T extends State = State> {
	<S extends SelectorMap>(selectorMap?: S) : Store<T, S>;
}
export interface StreamAdapter<T extends State = State> {
	<S extends SelectorMap>(selectorMap? : S) : <
		A extends ConnectProps<T, S>
	>(wrappedFn : (args : A) => unknown) => (
		(args : OwnPropsOf<A>) => unknown
	);
}

import type {
	PropertyInfo,
	Transform
} from '@webkrafters/data-distillery';

import type {
	Connection,
	UpdatePayload
} from '@webkrafters/auto-immutable';

import type {
	Changes,
	Data,
	IStorage,
	ProviderProps,
	Listener,
	Prehooks,
	SelectorMap,
	State,
	Store,
	StoreRef,
	RawProviderProps,
	Unsubscribe,
} from '..';

import isBoolean from 'lodash.isboolean';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import isPlainObject from 'lodash.isplainobject';
import set from 'lodash.set';

import mapPathsToObject from '@webkrafters/data-distillery';
import stringToDotPath from '@webkrafters/path-dotize';
import AutoImmutable from '@webkrafters/auto-immutable';

import * as constants from '../constants';

import Storage from '../model/storage';

let iCount = -1;
const createStorageKey = () => `${ ++iCount }:${ Date.now() }:${ Math.random() }`;
// to facilitate testing
export const deps = { createStorageKey };

const defaultPrehooks : Readonly<Prehooks<State>> = Object.freeze({});

export class LiveStore<
	T extends State = State,
	S extends SelectorMap = SelectorMap
> implements Store<T,S> {

	private _context : ObservableContext<T> = null;
	private _connection : Connection<T> = null;
	private _data = {} as Data<S, T>;
	private _fullStateSelectorIndex = -1;
	private _selectorMap : S = null;
	private _selectorMapInverse = {};
	private _onDataChange : () => void = null;
	private _renderKeys : Array<string> = [];
	private _unsubscribe : Unsubscribe = null;

	constructor( context : ObservableContext<T>, selectorMap? : S ) {
		this._context = context;
		this._connection = this._context.cache.connect();
		if( isEmpty( selectorMap ) ) { return }
		this._unsubscribe = this._context.store.subscribe( this._dataSourceListener );
		this._selectorMap = selectorMap;
		this._renderKeys = Object.values( selectorMap as {} );
		this._fullStateSelectorIndex = this._renderKeys.indexOf( constants.FULL_STATE_SELECTOR );
		for( const selectorKey in this._selectorMap ) {
			this._selectorMapInverse[ this._selectorMap[ selectorKey as string ] ] = selectorKey;
		}
		const state = this._connection.get( ...this._refineKeys() as string[] );
		for( const propertyPath of this._renderKeys ) {
			this._data[ this._selectorMapInverse[ propertyPath ] ] = state[
				propertyPath === constants.FULL_STATE_SELECTOR
					? constants.GLOBAL_SELECTOR
					: propertyPath
			];
		}
		this._refreshDataRef();
	}
	
	public get data() { return this._data }
	
	public set onDataChange(
		handler : typeof this._onDataChange
	) { this._onDataChange = handler }

	public set selectorMap( selectorMap : S ) {
		selectorMap = selectorMap ?? null;
		if( this._context.cache.closed || selectorMap === this.selectorMap || isEqual( selectorMap, this.selectorMap ) ) { return }
		this._unsubscribe?.();
		this._connection.disconnect();
		this._connection = this._context.cache.connect();
		this._selectorMapInverse = {};
		if( isEmpty( selectorMap ) ) {
			this._selectorMap = null;
			this._renderKeys = [];
			this._fullStateSelectorIndex = -1;
			this._data = {} as typeof this._data;
			this._refreshDataRef();
		} else {
			this._selectorMap = selectorMap;
			this._renderKeys = Object.values( selectorMap as {} );
			this._fullStateSelectorIndex = this._renderKeys.indexOf( constants.FULL_STATE_SELECTOR );
			for( const selectorKey in this._selectorMap ) {
				this._selectorMapInverse[ this._selectorMap[ selectorKey as string ] ] = selectorKey;
			}
			this._unsubscribe = this._context.store.subscribe( this._dataSourceListener );
			this._updateData();
		}
	}

	public close() {
		this._unsubscribe?.();
		this._connection.disconnect();
		this._unsubscribe = null;
		this._connection = null;
		this._context = null;
	}
	
	public resetState( propertyPaths = this._renderKeys as Array<string> ) {
		this._context.store.resetState( propertyPaths );
	}

	public setState( changes : Changes<T> ) {
		this._context.store.setState( changes );
	}

	private _dataSourceListener : Listener = (
		changes, changePathsTokens, netChanges, mayHaveChangesAt
	) => {
		for( let _Len = this._renderKeys.length, _ = 0; _ < _Len; _++ ) {
			if( this._renderKeys[ _ ] !== constants.FULL_STATE_SELECTOR && !mayHaveChangesAt(
				stringToDotPath( this._renderKeys[ _ ] as string ).split( '.' )
			) ) { continue }
			return this._updateData();
		}
	};

	private _updateData = () => {
		let hasChanges = false;
		const state = this._connection.get( ...this._refineKeys() as Array<string> );
		for( const propertyPath of this._renderKeys ) {
			const selectorKey = this._selectorMapInverse[ propertyPath ];
			if( propertyPath === constants.FULL_STATE_SELECTOR ) {
				if( this._data[ selectorKey ] === state[ constants.GLOBAL_SELECTOR ] ) { continue }
				this._data[ selectorKey ] = state[ constants.GLOBAL_SELECTOR ];
				hasChanges = true;
				continue;
			}
			if( this._data[ selectorKey ] === state[ propertyPath ] ) { continue }
			this._data[ selectorKey ] = state[ propertyPath ];
			hasChanges = true;
		}
		hasChanges && this._refreshDataRef();
	}
	
	private _refineKeys = () => {
		const rKeys = this._renderKeys.slice();
		if( this._fullStateSelectorIndex !== -1 ) {
			rKeys[ this._fullStateSelectorIndex ] = constants.GLOBAL_SELECTOR;
		}
		return rKeys;
	}

	private _refreshDataRef() {
		this._data = { ...this._data };
		this._onDataChange?.();
	}
}

export class ObservableContext<T extends State = State>{

	private _cache : AutoImmutable<T>;
	private _prehooks : Prehooks<T>;
	private _storage : IStorage<T>;
	private _store : StoreRef<T>;
	private _stream : Stream<T>;
	private _streamAdapter : StreamAdapter<T>;
	private connection : Connection<T>;
	private inchoateValue : T;
	private listeners : Set<Listener>;
	private storageKey : string = null;

	constructor(
		value? : AutoImmutable<T>,
		prehooks? : Prehooks<T>,
		storage? : IStorage<T>
	);
	constructor(
		value? : T,
		prehooks? : Prehooks<T>,
		storage? : IStorage<T>
	);
	constructor(
		value = {} as T,
		prehooks = null,
		storage = null
	) {
		if( !( value instanceof AutoImmutable ) ) {
			this.inchoateValue = value;
			this._cache = new AutoImmutable<T>( this.inchoateValue );
		} else {
			this._cache = value;
			const tConnection = this._cache.connect();
			this.inchoateValue = tConnection.get( constants.FULL_STATE_SELECTOR )[ constants.FULL_STATE_SELECTOR ];
			tConnection.disconnect();
		}
		this.connection = this._cache.connect();
		this.listeners = new Set<Listener>();
		this._prehooks = prehooks;
		this._stream = selectorMap => new LiveStore( this, selectorMap );
		this._streamAdapter = selectorMap => {
			const connect = wrappedFn => {
				const store = this._stream( selectorMap );
				return args => wrappedFn({ store, ...args });
			}
			return connect;
		};
		this._storage = storage;
		const ctx = this;
		this._store = {
			getState( propertyPaths : Array<string> = [] ) { return getState( ctx.connection, propertyPaths ) as T },
			resetState( propertyPaths : Array<string> = [] ) { ctx.resetState( ctx.connection, propertyPaths ) },
			setState( changes : Changes<T> ) { ctx.setState( ctx.connection, changes ) },
			subscribe( listener : Listener ) { return ctx.subscribe( listener ) }
		}
	}
    
	public get cache() { return this._cache }
	public get prehooks() { return this._prehooks }
	public get storage() { return this._storage }

	public set prehooks( prehooks : Prehooks<T> ) {
		this._prehooks = prehooks ?? defaultPrehooks;
	}

	public set storage( storage : IStorage<T>  ) {
		let data : T;
		storage ??= new Storage<T>();
		if( typeof this._storage !== 'undefined' ) {
			data = this._storage.getItem( this.storageKey );
			this._storage.removeItem( this.storageKey );
		} else {
			data = storage.clone( this.inchoateValue );
			this.inchoateValue = undefined;
		}
		this._storage = storage;
		this.storageKey = ( this._storage as CurrentStorage<T> ).isKeyRequired
			? deps.createStorageKey()
			: null;
		this._storage.setItem( this.storageKey, data );
	};

	public get store() { return this._store };

	/**
	 * @example
	 * const stream = this.stream;
	 * const liveStore = this.stream( ...propertyPath... );
     * a valid property path follows the `lodash` object property path convention.
     * for a state = { a: 1, b: 2, c: 3, d: { e: 5, f: [6, { x: 7, y: 8, z: 9 } ] } }
     * Any of the following is an applicable selector map.
     * ['d', 'a'] => {
     * 		0: { e: 5, f: [6, { x: 7, y: 8, z: 9 } ] },
     * 		1: 1
     * }
     * {myData: 'd', count: 'a'} => {
     * 		myData: { e: 5, f: [6, { x: 7, y: 8, z: 9 } ] },
     * 		count: 1
     * }
     * {count: 'a'} => {count: 1} // same applies to {count: 'b'} = {count: 2}; {count: 'c'} = {count: 3}
     * {myData: 'd'} => {mydata: { e: 5, f: [6, { x: 7, y: 8, z: 9 } ] }}
     * {xyz: 'd.e'} => {xyz: 5}
     * {def: 'd.e.f'} => {def: [6, { x: 7, y: 8, z: 9 } ]}
     * {f1: 'd.e.f[0]'} or {f1: 'd.e.f.0'} => {f1: 6}
     * {secondFElement: 'd.e.f[1]'} or {secondFElement: 'd.e.f.1'} => {secondFElement: { x: 7, y: 8, z: 9 }}
     * {myX: 'd.e.f[1].x'} or {myX: 'd.e.f.1.x'} => {myX: 7} // same applies to {myY: 'd.e.f[1].y'} = {myY: 8}; {myZ: 'd.e.f[1].z'} = {myZ: 9}
     * {myData: '@@STATE'} => {myData: state}
     */
	public get stream() { return this._stream }

	/**
	 * a reusable HOC function for connecting its WrappedComponent argument to the context stream.
     * @see {ObservableContext<STATE>::stream} regarding more details on selector map.
	 * @template {State} STATE
     */
	public get streamAdapter() { return this._streamAdapter }

	public destroy() {
		this._storage.removeItem( this.storageKey );
		this.connection.disconnect();
		this._cache.close();
		this.listeners.clear();
	}
	
	protected emit = ( changes : Changes<T> ) => (
		netChanges : Readonly<Partial<T>>,
		changedPathsTokens : Array<Array<string>>
	) => {
		const mayHaveChangesAt = createChangePathSearch( changedPathsTokens );
		this.listeners.forEach( listener => listener( changes, changedPathsTokens, netChanges, mayHaveChangesAt ) );
	};

	protected resetState(
		connection : Connection<T>,
		propertyPaths : Array<string> = []
	) {
		const { CLEAR_TAG, DELETE_TAG, FULL_STATE_SELECTOR, GLOBAL_SELECTOR, REPLACE_TAG } = constants
		const original = this.storage.clone( this.storage.getItem( this.storageKey ) );
		let resetData;
		if( !propertyPaths.length ) {
			resetData = {};
		} else if( propertyPaths.includes( FULL_STATE_SELECTOR ) ) {
			resetData = isEmpty( original ) ? CLEAR_TAG : { [ REPLACE_TAG ]: original };
		} else {
			const visitedPathMap = {};
			const transformer = ({ trail, value } : PropertyInfo ) => {
				visitedPathMap[ trail.join( '.' ) ] = null;
				return { [ REPLACE_TAG ]: value };
			} 
			resetData = mapPathsToObject( original, propertyPaths, transformer as Transform );
			if( Object.keys( visitedPathMap ).length < propertyPaths.length ) {
				for( let path of propertyPaths ) {
					path = stringToDotPath( path );
					if( path in visitedPathMap ) { continue }
					let trail = path.split( '.' );
					const keyTuple = trail.slice( -1 );
					trail = trail.slice( 0, -1 );
					let node = resetData;
					for( const t of trail ) {
						if( isEmpty( node[ t ] ) ) {
							node[ t ] = {};
						}
						node = node[ t ];
					}
					if( DELETE_TAG in node ) {
						node[ DELETE_TAG ].push( ...keyTuple );
					} else {
						node[ DELETE_TAG ] = keyTuple;
					}
				}
			}
		}
		runPrehook( this.prehooks, 'resetState', [
			resetData, {
				current: connection.get( GLOBAL_SELECTOR )[ GLOBAL_SELECTOR ],
				original
			}
		] ) && connection.set( resetData, () => this.emit( resetData ) );
	}

	protected setState(
		connection : Connection<T>,
		changes : Changes<T>
	) {
		if( !runPrehook( this.prehooks, 'setState', [ changes ] ) ) { return }
		if( !Array.isArray( changes ) ) {
			changes = transformPayload( changes );
		} else {
			changes = changes.slice();
			for( let c = changes.length; c--; ) {
				changes[ c ] = transformPayload( changes[ c ] );
			}
		}
		connection.set( changes, () => this.emit( changes ) );
	}

	protected subscribe( listener : Listener ) {
		this.listeners.add( listener );
		return () => this.listeners.delete( listener );
	}

}

export function createObservableContext<T extends State = State>( props : ProviderProps<T> = {} ) {
	return new ObservableContext<T>( props.value, props.prehooks, props.storage );
}


/* ------------------------------------------------------- */

// @debug [BEGINS]

type TestStateQ = { a : number };
type TestSelectorMapQ = { anchor : 'a' };
const obCtxImpl = new ObservableContext<TestStateQ>({ a: 22 });
const adapterImpl = obCtxImpl.streamAdapter({ anchor: 'a' });
interface PropsImpl extends ConnectProps<
	TestStateQ,
	TestSelectorMapQ
> {
	make : string;
	model : string;
	store : Store<TestStateQ, TestSelectorMapQ>;
	year : number;
};
const MyFnImpl= ( props : PropsImpl ) => props.year;
const connectedFnImpl = adapterImpl( MyFnImpl );
() => connectedFnImpl({ make: 'toyota', model: 'camry', year: 1996 });

// @debug [ENDS]

/* ------------------------------------------------------ */


/**
 * @param {Array<Array<string>>} changedPathsTokens - list containing tokenized changed object paths.
 * @returns {Function} - function verifying that a random tokenized object path falls within the changed paths domain.
 */
function createChangePathSearch({ length, ...pathTokenGroups } : Readonly<Array<Array<string>>> ){
	const root = {};
	for( let g = 0; g < length; g++ ) {
		for( let obj = root, tokens = pathTokenGroups[ g ], tLen = tokens.length, t = 0; t < tLen; t++ ) {
			const key = tokens[ t ];
			if( !( key in obj ) ) {
				obj[ key ] = {};
			}
			obj = obj[ key ];
		}
	}
	return ({ length, ...pathTokens }: Array<string> ) => {
		let obj = root;
		for( let p = 0; p < length; p++ ) {
			const key = pathTokens[ p ];
			if( key in obj ) {
				obj = obj[ key ];
				continue;
			}
			return !Object.keys( obj ).length;
		}
		return true;
	}
}

function getState<T extends State>(
	connection : Connection<T>,
	propertyPaths : Array<string> = []
) : Readonly<Partial<T>> {
	if( !propertyPaths.length || propertyPaths.indexOf( constants.FULL_STATE_SELECTOR ) !== -1 ) {
		return connection.get( constants.GLOBAL_SELECTOR )[ constants.GLOBAL_SELECTOR ];
	}
	const data = connection.get( ...propertyPaths );
	const state : Partial<T> = {};
	for( const d in data ) { set( state, d, data[ d ] ) }
	return mkReadonly( state );
}

function mkReadonly( v : any ) {
	if( Object.isFrozen( v ) ) { return v }
	if( isPlainObject( v ) || Array.isArray( v ) ) {
		for( const k in v ) { v[ k ] = mkReadonly( v[ k ] ) }
	}
	return Object.freeze( v );
}

function runPrehook <T extends State>( prehooks : Prehooks<T>, name : "resetState", args : [
	Partial<T>, {
		current : T;
		original : T;
	}
] ) : boolean; 
function runPrehook <T extends State>( prehooks : Prehooks<T>, name : "setState", args : [ Changes<T>] ) : boolean; 
function runPrehook <T extends State>( prehooks, name, args ) : boolean {
	if( !( name in prehooks ) ) { return true }
	const res = prehooks[ name ]( ...args );
	if( !isBoolean( res ) ) {
		throw new TypeError( `\`${ name }\` prehook must return a boolean value.` );
	}
	return res;
}

function transformPayload<T extends State>( payload : UpdatePayload<T> ) {
	if( isEmpty( payload ) || !( constants.FULL_STATE_SELECTOR in payload ) ) { return payload }
	payload = { ...payload, [ constants.GLOBAL_SELECTOR ]: payload[ constants.FULL_STATE_SELECTOR ] };
	delete payload[ constants.FULL_STATE_SELECTOR ];
	return payload;
}
