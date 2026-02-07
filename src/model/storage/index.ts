import clonedeep from '@webkrafters/clone-total';

import type { IStorage, State } from '../..';

class MemoryStorage<T extends State> implements IStorage<T> {
	private _data : T;
	constructor() { this._data = null }
	clone( data : T ) : T { return clonedeep( data ) }
	getItem( key : string ) { return this._data }
	removeItem( key : string ) { this._data = null }
	setItem( key : string, data : T ) { this._data = data }
}

class SessionStorage<T extends State> implements IStorage<T> {
	private _storage : globalThis.Storage;
	constructor() { this._storage = globalThis.sessionStorage }
	clone( data : T ) { return data }
	getItem( key : string ) { return JSON.parse( this._storage.getItem( key ) ) }
	removeItem( key : string ) { return this._storage.removeItem( key ) }
	setItem( key : string, data : T ) { return this._storage.setItem( key, JSON.stringify( data ) ) }
}

class Storage<T extends State> implements IStorage<T> {
	private _storage : IStorage<T>;
	static supportsSession = typeof globalThis.sessionStorage?.setItem === 'undefined';
	constructor() {
		this._storage = Storage.supportsSession
			? new SessionStorage()
			: new MemoryStorage()
	}
	get isKeyRequired() { return this._storage instanceof SessionStorage }
	clone( data ) { return this._storage.clone( data ) }
	getItem( key : string ) { return this._storage.getItem( key ) }
	removeItem( key : string ) { this._storage.removeItem( key ) }
	setItem( key : string, data : T ) { this._storage.setItem( key, data ) }
}

export default Storage;
