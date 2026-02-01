import clonedeep from '@webkrafters/clone-total';

import type { IStorage, State } from '../..';

class MemoryStorage<T extends State> implements IStorage<T> {
	#data : T;
	constructor() { this.#data = null }
	clone( data : T ) : T { return clonedeep( data ) }
	getItem( key : string ) { return this.#data }
	removeItem( key : string ) { this.#data = null }
	setItem( key : string, data : T ) { this.#data = data }
}

class SessionStorage<T extends State> implements IStorage<T> {
	#storage : globalThis.Storage;
	constructor() { this.#storage = globalThis.sessionStorage }
	clone( data : T ) { return data }
	getItem( key : string ) { return JSON.parse( this.#storage.getItem( key ) ) }
	removeItem( key : string ) { return this.#storage.removeItem( key ) }
	setItem( key : string, data : T ) { return this.#storage.setItem( key, JSON.stringify( data ) ) }
}

class Storage<T extends State> implements IStorage<T> {
	#storage : IStorage<T>;
	static supportsSession = typeof globalThis.sessionStorage?.setItem === 'undefined';
	constructor() {
		this.#storage = Storage.supportsSession
			? new SessionStorage()
			: new MemoryStorage()
	}
	get isKeyRequired() { return this.#storage instanceof SessionStorage }
	clone( data ) { return this.#storage.clone( data ) }
	getItem( key : string ) { return this.#storage.getItem( key ) }
	removeItem( key : string ) { this.#storage.removeItem( key ) }
	setItem( key : string, data : T ) { this.#storage.setItem( key, data ) }
}

export default Storage;
