import type { Connection } from '@webkrafters/auto-immutable';

import type {
	BaseStream,
	Changes,
	CurrentStorage,
	Data,
	IStorage,
	Listener,
	Prehooks,
	ProviderProps,
	RawProviderProps,
	SelectorMap,
	ShutdownMonitor,
	State,
	Store,
	StoreInternal,
	StoreRef,
	Unsubscribe
} from '..';

import isBoolean from 'lodash.isboolean';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import isPlainObject from 'lodash.isplainobject';

import get from '@webkrafters/get-property';
import stringToDotPath from '@webkrafters/path-dotize';
import AutoImmutable from '@webkrafters/auto-immutable';

import * as constants from '../constants';

import Storage from '../model/storage';

import {
	Phase,
	ShutdownReason
} from '..';

let iCount = -1;
const createStorageKey = () => `${ ++iCount }:${ Date.now() }:${ Math.random() }`;
// to facilitate testing
export const deps = { createStorageKey };

const defaultPrehooks : Readonly<Prehooks<State>> = Object.freeze({});

const { FULL_STATE_SELECTOR } = constants;

export const ACCESS_SYM = Symbol( 'KNOWN_ENTITY_ID' );

class Event<
	LISTENER extends Function = (()=>{}),
	LISTENER_PARAMS extends Array<unknown> = Array<unknown>
> {	
	private listeners = new Set<LISTENER>();

	emit( ...args : LISTENER_PARAMS ) {
		this.listeners.forEach( listener => listener( ...args ) );
	}
	addListener( listener : LISTENER ) { this.listeners.add( listener ) }
	removeListener( listener : LISTENER ) { this.listeners.delete( listener ) }
}

export class Channel<
	T extends State = State,
	S extends SelectorMap = SelectorMap
> implements Store<T,S> {
	private _context : EagleEyeContext<T> = null;
	private _internalStore : StoreInternal<T> = null;
	private _data = {} as Data<S, T>;
	private eventMap = {
		'data-changed': new Event(),
		'stream-ending': new Event<ShutdownMonitor, [ShutdownReason]>()
	};
	private _phase = Phase.UN_OPENED;
	private _selectorMap : S = null;
	private _unsubClosing : Unsubscribe = null;
	private _unsubscribe : Unsubscribe = null;

	constructor( context : EagleEyeContext<T>, selectorMap? : S ) {
		this._context = context;
		this._setupInternalStore();
		if( isEmpty( selectorMap ) ) {
			this._phase = Phase.OPENED;
			return;
		}
		this._integrateSelectors( selectorMap );
		this._phase = Phase.OPENED;
	}

	get closed() { return !this._internalStore || this._internalStore.closed }

	get data() { return this._data }

	get phase() { return this._phase }

	get streaming() {
		return this._phase === Phase.OPENED || this._phase === Phase.UN_OPENED
	}
	
	@streamable
	set selectorMap( selectorMap : S ) {
		if( !selectorMap || isEmpty( selectorMap ) ) {
			selectorMap = null;
		}
		if( selectorMap === this._selectorMap
			|| isEqual( selectorMap, this._selectorMap )
			|| this._phase === Phase.UN_OPENED
		) { return }
		this._updateInternalStore();
		this._integrateSelectors( selectorMap );
	}

	addListener( eventType : 'stream-ending', listener : ShutdownMonitor ) : void;
	addListener( eventType : 'data-changed', listener : () => void ) : void;
	@streamable
	addListener( eventType, listener ) : void {
		this.eventMap[ eventType ].addListener( listener );
	}

	@streamable
	endStream() {
		this._phase = Phase.CLOSING;
		this.eventMap[ 'stream-ending' ].emit( ShutdownReason.LOCAL );
		this._internalStore.close();
		this._reclaim();
	}

	removeListener( eventType : 'stream-ending', listener : ShutdownMonitor ) : void;
	removeListener( eventType : 'data-changed', listener : ()=>void ) : void;
	@streamable
	removeListener( eventType, listener ) : void {
		this.eventMap[ eventType ].removeListener( listener );
	}
	
	@streamable
	resetState( propertyPaths = this._renderKeys ) {
		propertyPaths.length && this._internalStore.resetState( propertyPaths );
	}

	@streamable
	setState( changes : Changes<T> ) {
		this._internalStore.setState( changes );
	}

	@streamable
	protected subscribe() {
		this._unsubscribe ||= this._internalStore.subscribe(
			'data-updated', this._dataSourceListener
		);
	}

	@streamable
	protected unsubscribe() {
		// istanbul ignore next
		if( !this._unsubscribe ) { return }
		this._unsubscribe();
		this._unsubscribe = null;
	}

	private get _renderKeys() {
		return Object.values( ( this._selectorMap as {} ) ?? {} ) as Array<string>;
	}

	private _dataSourceListener : Listener = (
		changes, changePathsTokens, netChanges, mayHaveChangesAt
	) => {
		for( let renderKeys = this._renderKeys, rLen = renderKeys.length, r = 0; r < rLen; r++ ) {
			if( renderKeys[ r ] !== FULL_STATE_SELECTOR && !mayHaveChangesAt(
				stringToDotPath( renderKeys[ r ] as string ).split( '.' )
			) ) { continue }
			return this._updateData();
		}
	};

	private _integrateSelectors( selectorMap : S ) {
		this._selectorMap = selectorMap;
		if( !selectorMap ) {
			this._data = {} as typeof this._data;
			return this._refreshDataRef();
		}
		this.subscribe();
		const state = this._internalStore.getState( this._renderKeys );
		const newData = {} as typeof this._data;
		for( const k in selectorMap ) {
			newData[ k as string ] = selectorMap[ k ] !== FULL_STATE_SELECTOR
				? get( state, selectorMap[ k ] as string ).value
				: state;
		}
		this._data = newData;
		this._refreshDataRef();
	}

	private _reclaim() {
		this._selectorMap && this.unsubscribe();
		this._unsubClosing()
		this._context = null;
		this._internalStore = null;
		this.eventMap = null;
		this._unsubClosing = null;
		this._unsubscribe = null;
		this._phase = Phase.CLOSED;
	}

	private _refreshDataRef() {
		this._data = { ...this._data };
		this.eventMap[ 'data-changed' ].emit();
	}

	private _setupInternalStore() {
		this._internalStore = this._context.createInternalStore( ACCESS_SYM );
		this._unsubClosing = this._internalStore.subscribe( 'closing', r => {
			this._phase = Phase.CLOSING;
			this.eventMap[ 'stream-ending' ].emit( r );
			this._reclaim();
		} );
	}

	private _updateData = () => {
		let hasChanges = false;
		const selectorEntries = Object.entries( this._selectorMap as {} );
		const state = this._internalStore.getState( this._renderKeys );
		for( const [ label, path ] of selectorEntries ) {
			if( path !== FULL_STATE_SELECTOR ) {
				const slice = get( state, path as string )._value;
				if( this._data[ label ] === slice ) { continue }
				this._data[ label ] = slice;
				hasChanges = true;
				continue;
			}
			// istanbul ignore next
			const keys = Object.keys( this._data[ label ] ?? {} );
			let _hasChanges = keys.length !== Object.keys( state ).length;
			for( let i = keys.length, data = this._data[ label ]; !_hasChanges && i--; ) {
				_hasChanges = data[ keys[ i ] ] !== state[ keys[ i ] ];
			}
			// istanbul ignore next
			if( !_hasChanges ) { continue }
			this._data[ label ] = state;
			hasChanges = true;
		}
		hasChanges && this._refreshDataRef();
	}

	private _updateInternalStore() {
		this._selectorMap && this.unsubscribe();
		this._unsubClosing();
		this._internalStore.close();
		this._setupInternalStore();
	}
}

export class EagleEyeContext<T extends State = State>{

	private _cache : AutoImmutable<T>;
	private _cacheCloseMonitor : () => void;
	private _prehooks : Prehooks<T>;
	private _storage : IStorage<T>;
	private _store : StoreInternal<T>;
	private _storeRef : StoreRef<T>;
	private eventMap = {
		closing: new Event<ShutdownMonitor, [ShutdownReason]>(),
		'data-updated': new Event<Listener, [
			changes : Changes<T>,
			changePathsTokens : Array<Array<string>>,
			netChanges : Readonly<Partial<T>>,
			mayHaveChangesAt : (pathTokens: Array<string>) => boolean
		]>()
	};
	private inchoateValue : T;
	private storageKey : string = null;

	protected _stream : BaseStream<T> = selectorMap => new Channel( this, selectorMap );

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
			this.inchoateValue = tConnection.get()[ constants.GLOBAL_SELECTOR ];
			tConnection.disconnect();
			this._cacheCloseMonitor = () => {
				this.notifyClosing( ShutdownReason.CACHE );
				this._store.close();
				this._reclaim();
			}
			this._cache.onClose( this._cacheCloseMonitor );
		}
		this.prehooks = prehooks;
		this.storage = storage;
		this._store = this._createInternalStore();
		this._storeRef = {
			getState: this._store.getState,
			resetState: this._store.resetState,
			setState: this._store.setState,
			subscribe: this._store.subscribe
		};
	}

	get cache() { return this._cache }
	get closed() { return !this._cache }
	get prehooks() { return this._prehooks }
	get storage() { return this._storage }
	get store() { return this._storeRef };

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
	@invokable
	get stream() { return this._stream }

	@invokable
	set prehooks( prehooks : Prehooks<T> ) {
		this._prehooks = prehooks ?? defaultPrehooks;
	}

	@invokable
	set storage( storage : IStorage<T> ) {
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
		// istanbul ignore next
		this.storageKey = ( this._storage as CurrentStorage<T> ).isKeyRequired
			? deps.createStorageKey()
			: null;
		this._storage.setItem( this.storageKey, data );
	};

	@invokable
	createInternalStore( access : Symbol = null ) {
		if( access === ACCESS_SYM ) { return this._createInternalStore() }
		throw new Error( 'May not create internal stores out of context. Please use `this.store` to obtain externally available store reference.' );
	}					

	@invokable
	dispose() {
		this.notifyClosing( ShutdownReason.CONTEXT );
		this._cacheCloseMonitor
			? this._cache.offClose( this._cacheCloseMonitor )
			: this._cache.close()
		this._store.close();
		this._reclaim();
	}

	protected createUpdateEmitterFor( changes : Changes<T> ) {
		return (
			netChanges : Readonly<Partial<T>>,
			changedPathsTokens : Array<Array<string>>
		) => this.eventMap[ 'data-updated' ].emit(
			changes,
			changedPathsTokens,
			netChanges,
			createChangePathSearch( changedPathsTokens )
		);
	}

	@invokable
	protected disconnectInternalStore( connection : Connection<T> ) { connection.disconnect() }

	@invokable
	protected getState(
		connection : Connection<T>,
		propertyPaths : Array<string>
	) {
		return getState( connection, propertyPaths );
	}

	@invokable
	protected notifyClosing( reason : ShutdownReason ) {
		this.eventMap.closing.emit( reason );
	}

	@invokable
	protected resetState(
		connection : Connection<T>,
		propertyPaths : Array<string>
	) {
		const {
			CLEAR_TAG,
			DELETE_TAG,
			FULL_STATE_SELECTOR,
			GLOBAL_SELECTOR,
			REPLACE_TAG
		} = constants;
		const original = this.storage.clone( this.storage.getItem( this.storageKey ) );
		let resetData = {};
		if( propertyPaths.includes( FULL_STATE_SELECTOR ) ) {
			resetData = isEmpty( original ) ? CLEAR_TAG : { [ REPLACE_TAG ]: original };
		} else {
			for( let path of propertyPaths ) {
				let node = resetData;
				const tokens = stringToDotPath( path ).split( '.' );
				const { trail, ...pInfo } = get( original, tokens );
				for( let { length, ...keys } = trail, k = 0; k < length; k++ ) {
					if( REPLACE_TAG in node ) { continue }
					const key = keys[ k ];
					if( !( key in node ) ) { node[ key ] = {} }
					node = node[ key ];
				}
				if( REPLACE_TAG in node ) { continue }
				if( pInfo.exists ) {
					for( const k in node ) { delete node[ k ] }
					node[ REPLACE_TAG ] = pInfo._value;
					continue;
				}
				if( !( DELETE_TAG in node ) ) { node[ DELETE_TAG ] = [] }
				const deletingKey = tokens[ trail.length ];
				!node[ DELETE_TAG ].includes( deletingKey ) &&
				node[ DELETE_TAG ].push( deletingKey );
			}
		}
		runPrehook( this._prehooks, 'resetState', [
			resetData, {
				current: connection.get()[ GLOBAL_SELECTOR ],
				original
			}
		] ) && connection.set( resetData, this.createUpdateEmitterFor( resetData ) );
	}

	@invokable
	protected setState(
		connection : Connection<T>,
		changes : Changes<T>
	) {
		runPrehook( this._prehooks, 'setState', [ changes ] ) &&
		connection.set( changes, this.createUpdateEmitterFor( changes ) );
	}

	protected subscribe( eventType : 'closing', listener : ShutdownMonitor ) : Unsubscribe;
	protected subscribe( eventType : 'data-updated', listener : Listener ) : Unsubscribe;
	@invokable
	protected subscribe( eventType, listener ) : Unsubscribe {
		const event = this.eventMap[ eventType ];
		event.addListener( listener );
		return () => event.removeListener( listener );
	}

	private _createInternalStore() {
		const ctx = this;
		let connection = ctx._cache.connect();
		return {
			close: () => {
				ctx.disconnectInternalStore( connection );
				connection = null;
			},
			get closed() { return !connection },
			getState: ( propertyPaths = [] ) => ctx.getState( connection, propertyPaths ) as T,
			resetState: ( propertyPaths = [] ) => ctx.resetState( connection, propertyPaths ),
			setState: changes => ctx.setState( connection, changes ),
			subscribe: ctx.subscribe.bind( ctx )
		} as StoreInternal<T>;
	}

	private _reclaim() {
		this._storage.removeItem( this.storageKey );
		this._cache = null;
		this._prehooks = null;
		this._storage = null;
		this.eventMap = null;
		this.inchoateValue = null;
		this.storageKey = null;
		this._stream = null;
		this._cacheCloseMonitor = null;
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
	propertyPaths : Array<string>
) : Readonly<Partial<T>> {
	const { FULL_STATE_SELECTOR, GLOBAL_SELECTOR } = constants;
	if( !propertyPaths.length || propertyPaths.indexOf( FULL_STATE_SELECTOR ) !== -1  ) {
		return connection.get()[ GLOBAL_SELECTOR ];
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

function runPrehook<T extends State>( prehooks : Prehooks<T>, name : "resetState", args : [
	Partial<T>, {
		current : T;
		original : T;
	}
] ) : boolean; 
function runPrehook<T extends State>( prehooks : Prehooks<T>, name : "setState", args : [ Changes<T>] ) : boolean; 
function runPrehook<T extends State>( prehooks, name, args ) : boolean {
	if( !( name in prehooks ) ) { return true }
	const res = prehooks[ name ]( ...args );
	if( !isBoolean( res ) ) {
		throw new TypeError( `\`${ name }\` prehook must return a boolean value.` );
	}
	return res;
}

function invokable<C>( method: Function, context: C ) {
    return function <T extends State = State>(
        this: EagleEyeContext<T>, ...args: Array<any>
    ) { if( !this.closed ) { return method.apply( this, args ) } }
}

function streamable<C>( method: Function, context: C ) {
    return function<
		T extends State = State,
		S extends SelectorMap = SelectorMap
	>( this: Channel<T, S>, ...args: Array<any> ) {
        if( this.streaming ) { return method.apply( this, args ) }
	}
}

const OPEN_PTN = /^[[.]+/;
const CLOSE_PTN = /[.\]]+$/;
const SEP_PTN = /\]*[[\].]+/;
const NUMERIC_PTN = /^[0-9]+$/;

/** Cannot use this function to mutate obj */
export function set<T>( obj : {}, path : Array<string|number>, value : T ) : void;
export function set<T>( obj : {}, path : string, value : T ) : void;
export function set<T>( obj, path, value : T ) : void {
	if( !Array.isArray( path ) ) {
		path = path
			.replace( OPEN_PTN, '' )
			.replace( CLOSE_PTN, '' )
			.split( SEP_PTN );
	}
	const pLen = path.length - 1;
	for( let p = 0; p < pLen; p++ ) {
		const key = path[ p ];
		const isArrayChildKey = NUMERIC_PTN.test( path[ p + 1 ] );
    	if( !obj[ key ] || typeof obj[ key ] !== 'object' ) {
			obj[ key ] = isArrayChildKey ? [] : {};
		} else if( !isArrayChildKey && Array.isArray( obj[ key ] ) ) {
			const arr = obj[ key ];
			obj[ key ] = {};
			for( let aLen = arr.length, a = 0; a < aLen; a++ ) {
				obj[ key ][ a ] = arr[ a ];
			}
    	}
		obj = obj[ key ];
	}
	obj[ path[ pLen ] ] = value;
}
