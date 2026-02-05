import type {
	PropertyInfo,
	Transform
} from '@webkrafters/data-distillery';

import type {
	Connection,
	UpdatePayload
} from '@webkrafters/auto-immutable';

import type {
	BaseStream,
	Changes,
	CurrentStorage,
	Data,
	IStorage,
	Listener,
	ProviderProps,
	Prehooks,
	RawProviderProps,
	SelectorMap,
	ShutdownMonitor,
	State,
	Store,
	StoreRef,
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

import { ShutdownReason } from '..';

let iCount = -1;
const createStorageKey = () => `${ ++iCount }:${ Date.now() }:${ Math.random() }`;
// to facilitate testing
export const deps = { createStorageKey };

const defaultPrehooks : Readonly<Prehooks<State>> = Object.freeze({});

class Event<
	LISTENER extends Function = (()=>{}),
	LISTENER_PARAMS extends Array<unknown> = Array<unknown>
> {	
	private listeners = new Set<LISTENER>();
	destroy() {
		this.listeners.clear();
		this.listeners = null;
	}
	emit( ...args : LISTENER_PARAMS ) {
		this.listeners.forEach( listener => listener( ...args ) );
	}
	addListener( listener : LISTENER ) { this.listeners.add( listener ) }
	removeListener( listener : LISTENER ) { this.listeners.delete( listener ) }
}

export class LiveStore<
	T extends State = State,
	S extends SelectorMap = SelectorMap
> implements Store<T,S> {

	private _context : EagleEyeContext<T> = null;
	private _connection : Connection<T> = null;
	private _ctxStoreRef : StoreRef<T> = null;
	private _data = {} as Data<S, T>;
	private eventMap = {
		closing: new Event<ShutdownMonitor, [ShutdownReason]>(),
		dataChange: new Event()
	};
	private _fullStateSelectorIndex = -1;
	private _isActive = true;
	private _selectorMap : S = null;
	private _selectorMapInverse = {};
	private _renderKeys : Array<string> = [];
	private _unsubClosing : Unsubscribe = null;
	private _unsubscribe : Unsubscribe = null;

	constructor( context : EagleEyeContext<T>, selectorMap? : S ) {
		this._context = context;
		this._updateConnection();
		if( isEmpty( selectorMap ) ) { return }
		this.subscribe();
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
	
	@invoke
	get data() { return this._data }

	@invoke
	get streaming() { return this._isActive }
	
	@invoke
	set selectorMap( selectorMap : S ) {
		selectorMap = selectorMap ?? null;
		if( selectorMap === this.selectorMap || isEqual( selectorMap, this.selectorMap ) ) { return }
		this._updateConnection()
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
			this.subscribe();
			this._updateData();
		}
	}

	addListener( eventType : 'closing', listener : ShutdownMonitor ) : void;
	addListener( eventType : 'dataChange', listener : ()=>void ) : void;
	@invoke
	addListener( eventType, listener ) : void {
		this.eventMap[ eventType ].addListener( listener );
	}

	@invoke
	close() {
		this.eventMap.closing.emit( ShutdownReason.LOCAL );
		this._connection.disconnect();
		this._reclaim();
	}

	removeListener( eventType : 'closing', listener : ShutdownMonitor ) : void;
	removeListener( eventType : 'dataChange', listener : ()=>void ) : void;
	@invoke
	removeListener( eventType, listener ) : void {
		this.eventMap[ eventType ].removeListener( listener );
	}
	
	@invoke
	resetState( propertyPaths = this._renderKeys as Array<string> ) {
		this._ctxStoreRef.resetState( propertyPaths );
	}

	@invoke
	setState( changes : Changes<T> ) {
		this._ctxStoreRef.setState( changes );
	}

	@invoke
	protected subscribe() {
		this._unsubscribe ||= this._ctxStoreRef.subscribe( 'dataUpdate', this._dataSourceListener );
	}

	@invoke
	protected unsubscribe() {
		if( !this._unsubscribe ) { return }
		this._unsubscribe();
		this._unsubscribe = null;
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

	private _reclaim() {
		this.unsubscribe();
		this._connection = null;
		this._context = null;
		this._isActive = false;
		for( let e in this.eventMap ) { this.eventMap[ e ].destroy() }
		this.eventMap = null;
		this._renderKeys = [];
		this._unsubscribe = null;
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
		this.eventMap.dataChange.emit();
	}

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

	private _updateConnection() {
		this.unsubscribe();
		this._unsubClosing?.();
		this._connection?.disconnect();
		this._connection = this._context.cache.connect();
		this._ctxStoreRef = this._context.createStoreRef( this._connection );
		this._unsubClosing = this._ctxStoreRef.subscribe( 'closing', r => {
			this.eventMap.closing.emit( r );
			this._reclaim();
		});
	}
}

export class EagleEyeContext<T extends State = State>{

	private _cache : AutoImmutable<T>;
	private _prehooks : Prehooks<T>;
	private _storage : IStorage<T>;
	private _store : StoreRef<T>;
	private connection : Connection<T>;
	private eventMap = {
		closing: new Event<ShutdownMonitor, [ShutdownReason]>(),
		dataUpdate: new Event<Listener, [
			Changes<T>,
			string[][],
			Readonly<Partial<T>>,
			({ length, ...pathTokens }: string[]) => boolean
		]>()
	};
	private inchoateValue : T;
	private isCacheLocal = true;
	private storageKey : string = null;

	protected _stream : BaseStream<T>;

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
			this.isCacheLocal = false;
			this._cache.onClose(() => {
				this.notifyClosing( ShutdownReason.CACHE );
				this._reclaim()
			});
		}
		this.connection = this._cache.connect();
		this._prehooks = prehooks;
		this._storage = storage;
		this._store = this._createStoreRef( this.connection );
		this.initStream();
	}

	get cache() { return this._cache }
	get prehooks() { return this._prehooks }
	get storage() { return this._storage }

	set prehooks( prehooks : Prehooks<T> ) {
		this._prehooks = prehooks ?? defaultPrehooks;
	}
	set storage( storage : IStorage<T>  ) {
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

	get store() { return this._store };

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
	get stream() { return this._stream }

	createStoreRef( connection : Connection<T> = this.connection ) {
		return connection !== this.connection
			? this._createStoreRef( connection )
			: this._store;
	}

	dispose() {
		this.notifyClosing( ShutdownReason.CONTEXT );
		this.connection.disconnect();
		this.isCacheLocal && this._cache.close();
		this._reclaim();
	}
	
	protected createUpdateEmitterFor( changes : Changes<T> ) {
		return (
			netChanges : Readonly<Partial<T>>,
			changedPathsTokens : Array<Array<string>>
		) => this.eventMap.dataUpdate.emit(
			changes,
			changedPathsTokens,
			netChanges,
			createChangePathSearch( changedPathsTokens )
		);
	}

	protected initStream() {
		this._stream = selectorMap => new LiveStore( this, selectorMap );
	}

	protected notifyClosing( reason : ShutdownReason ) {
		this.eventMap.closing.emit( reason );
	}

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
		] ) && connection.set( resetData, this.createUpdateEmitterFor( resetData ) );
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
		connection.set( changes, this.createUpdateEmitterFor( changes ) );
	}

	protected subscribe( eventType : 'closing', listener : ShutdownMonitor ) : Unsubscribe;
	protected subscribe( eventType : 'dataUpdate', listener : Listener ) : Unsubscribe;
	protected subscribe( eventType, listener ) : Unsubscribe {
		const event = this.eventMap[ eventType ];
		event.addListener( listener );
		return () => event.removeListener( listener );
	}

	private _createStoreRef( connection : Connection<T> ) {
		return (() => ({
			getState( propertyPaths = [] ) { return getState( connection, propertyPaths ) as T },
			resetState( propertyPaths = [] ) { this.resetState( connection, propertyPaths ) },
			setState( changes ) { this.setState( connection, changes ) },
			subscribe: this.subscribe
		}))();
	}

	private _reclaim() {
		this._storage.removeItem( this.storageKey );
		for( let e in this.eventMap ) { this.eventMap[ e ].destroy() }
		this.eventMap = null;
	}

}

export function createEagleEye<T extends State = State>( props? : RawProviderProps<T> ) : EagleEyeContext<T>;
export function createEagleEye<T extends State = State>( props? : ProviderProps<T> ) : EagleEyeContext<T>; 
export function createEagleEye<T extends State = State>( props = {} as ProviderProps<T> ) {
	return new EagleEyeContext<T>( props.value, props.prehooks, props.storage );
}

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

export function mkReadonly( v : any ) {
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

function invoke<C>( method: Function, context: C ) {
    return function <
		T extends State = State,
		S extends SelectorMap = SelectorMap
	>(
        this: LiveStore<T, S>,
        ...args: Array<any>
    ) {
        if( !this.streaming ) { return }
        return method.apply( this, args );
	};
}
