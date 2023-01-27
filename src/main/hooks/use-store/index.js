import { useCallback, useEffect, useRef, useState } from 'react';

import isBoolean from 'lodash.isboolean';

import { v4 } from 'uuid';

import { FULL_STATE_SELECTOR } from '../../../constants';

import { clonedeep, mapPathsToObject } from '../../../utils';

import Storage from '../../../model/storage';

import usePrehooksRef from '../use-prehooks-ref';
import useStateManager from '../use-state-manager';

import _setState from '../../set-state';

// to facilitate testing
export const deps = {
	setState: _setState,
	uuid: v4
};

/**
 *
 * @param {Prehooks<T>} prehooks
 * @param {N} name
 * @param {N extends "setState" ? [UpdatePayload<T>] : N extends "resetState" ? [PartialState<T>, {current:T, original:T}] : never } args
 * @returns {boolean}
 * @template {State} T
 * @template {keyof Prehooks<T>} N
 */
function runPrehook( prehooks, name, args ) {
	if( !( name in prehooks ) ) { return true }
	const res = prehooks[ name ]( ...args );
	if( !isBoolean( res ) ) {
		throw new TypeError( `\`${ name }\` prehook must return a boolean value.` );
	}
	return res;
}

/**
 * @param {Prehooks<T>} prehooks
 * @param {T} value
 * @param {IStorage<T>} [storage] Closed to modification post-initialization
 * @template {State} T
 */
const useStore = ( prehooks, value, storage ) => {

	const mounted = useRef( false );

	const prehooksRef = usePrehooksRef( prehooks );

	/** @type {MutableRefObject<string>} */
	const storageKey = useRef();

	const { select, state, stateWatch, unlink } = useStateManager( value );

	/** @type {[Set<Listener<T>>, Function]} */
	const [ listeners ] = useState(() => new Set());

	/** @type {[IStorage<T>, Function]} */
	const [ _storage ] = useState(() => {
		let isKeyRequired = true;
		let _storage = storage;
		if( !storage ) {
			_storage = new Storage();
			isKeyRequired = _storage.isKeyRequired;
		}
		storageKey.current = isKeyRequired
			? `${ deps.uuid() }:${ Date.now() }:${ Math.random() }`
			: null
		return _storage;
	});

	/** @type {Listener<T>} */
	const onChange = changes => listeners.forEach( listener => listener( changes ) );

	/** @type {StoreInternal<T>["resetState"]} */
	const resetState = useCallback(( propertyPaths = [] ) => {
		const original = _storage.clone( _storage.getItem( storageKey.current ) );
		const resetData = !propertyPaths.length
			? {}
			: propertyPaths.includes( FULL_STATE_SELECTOR )
				? original
				: mapPathsToObject( original, propertyPaths );
		runPrehook( prehooksRef.current, 'resetState', [
			resetData, { current: clonedeep( state ), original }
		]) && deps.setState( state, resetData, onChange );
	}, []);

	/** @type {StoreInternal<T>["setState"]} */
	const setState = useCallback( changes => {
		changes = clonedeep( changes );
		runPrehook( prehooksRef.current, 'setState', [ changes ] ) &&
		deps.setState( state, changes, onChange );
	}, [] );

	/** @type {StoreInternal<T>["subscribe"]} */
	const subscribe = useCallback( listener => {
		listeners.add( listener );
		return () => listeners.delete( listener );
	}, [] );

	useEffect(() => {
		const sKey = storageKey.current;
		_storage.setItem( sKey, _storage.clone( value ) );
		return () => _storage.removeItem( sKey );
	}, []);

	useEffect(() => {
		if( !mounted.current ) {
			mounted.current = true;
			return;
		}
		setState( clonedeep( value ) );
	}, [ value ]);

	useEffect(() => {
		if( !listeners.size ) {
			listeners.add( stateWatch );
		} else {
			const newList = Array.from( listeners );
			newList.unshift( stateWatch );
			listeners.clear();
			newList.forEach( l => { listeners.add( l ) } );
		}
		return () => listeners.delete( stateWatch );
	}, [ stateWatch ]);

	return useState(() => ({
		getState: select, resetState, setState, subscribe, unlinkCache: unlink
	}))[ 0 ];
};

export default useStore;

/**
 * @typedef {import("../../../types").IStorage<T>} IStorage
 * @template {State} T
 */

/**
 * @typedef {import("../../../types").UpdatePayload<PartialState<T>>} UpdatePayload
 * @template {State} T
 */

/**
 * @typedef {import('../../../types').PartialState<T>} PartialState
 * @template {State} T
 */

/**
 * @typedef {import("../../../types").Prehooks<T>} Prehooks
 * @template {State} T
 */

/**
 * @typedef {import("../../../types").StoreInternal<T>} StoreInternal
 * @template {State} T
 */

/** @typedef {import("../../../types").State} State */

/**
 * @typedef {import('react').MutableRefObject<T>} MutableRefObject
 * @template T
 */
