import Storage from '.';

const data = { name: { first: 'test', last: 'data' }, isTest: true };

describe( 'Storage class', () => {
	const mockImpls = {} as {
		getItem: jest.Mock<any, any, any>,
		removeItem: jest.Mock<any, any, any>,
		setItem: jest.Mock<any, any, any>
	};
	let origWinStorage;
	beforeAll(() => {
		if( typeof globalThis.sessionStorage?.setItem !== 'undefined' ) {
			origWinStorage = globalThis.sessionStorage;
		}
		[ 'getItem', 'removeItem', 'setItem' ].forEach( k => { mockImpls[ k ] = jest.fn() } );
		Object.defineProperty( globalThis, 'sessionStorage', {
			value: {
				data: null,
				getItem( ...args ) { mockImpls.getItem( ...args ); return this.data },
				removeItem( ...args ) { mockImpls.removeItem( ...args ); this.data = null },
				setItem( ...args ) { mockImpls.setItem( ...args ); this.data = args[ 1 ].toString() }
			}
		} );
	});
	afterAll(() => {
		if( origWinStorage ) {
			Object.defineProperty( globalThis, 'sessionStorage', { value: origWinStorage } );
		} else {
			delete globalThis.sessionStorage
		}
	});
	describe( 'in environment with built-in sesssion storage support', () => {
		let storage : Storage<typeof data>;
		beforeAll(() => {
			Storage.supportsSession = true;
			storage = new Storage();
		});
		afterAll( jest.clearAllMocks );
		test( 'creates an storage', () => expect( storage ).toBeInstanceOf( Storage ) );
		test( 'requires a key for entries into this storage', () => {
			expect( storage.isKeyRequired ).toBe( true );
		} );
		describe( 'clone(...)', () => {
			test( 'performs no cloning of the data - not needed as serialization operation takes care of this', () => {
				const data = { a: 30, b: false, c: 'test', d: [ 8 ], e: { w: 55 } };
				const cloned = storage.clone( data );
				expect( cloned ).toBe( data );
				expect( cloned ).toStrictEqual( data );
			} );
		} );
		describe( 'getItem(...)', () => {
			const key = 'a';
			let _data;
			beforeAll(() => {
				storage.setItem( key, data );
				_data = storage.getItem( key );
			});
			afterAll( jest.clearAllMocks );
			test( 'gets data directly from the session storage', () => {
				expect( mockImpls.getItem ).toHaveBeenCalledTimes( 1 );
				expect( mockImpls.getItem ).toHaveBeenCalledWith( key );
			} );
			test( 'gets a copy of the stored data', () => {
				expect( _data ).not.toBe( data );
				expect( _data ).toStrictEqual( data );
			} );
		} );
		describe( 'removeItem(...)', () => {
			test( 'removes data directly from the session storage', () => {
				const key = 'a';
				storage.removeItem( key );
				expect( mockImpls.removeItem ).toHaveBeenCalledTimes( 1 );
				expect( mockImpls.removeItem ).toHaveBeenCalledWith( key );
			} );
		} );
		describe( 'setItem(...)', () => {
			test( 'stores stringified version of the data directly into the session storage', () => {
				const key = 'a';
				storage.setItem( key, data );
				expect( mockImpls.setItem ).toHaveBeenCalledTimes( 1 );
				expect( mockImpls.setItem ).toHaveBeenCalledWith( key, expect.any( String ) );
				expect( mockImpls.setItem.mock.calls[ 0 ][ 1 ] ).toBe( JSON.stringify( data ) );
			} );
		} );
	} );
	describe( 'in environment with NO sesssion storage support', () => {
		let storage : Storage<typeof data>;
		beforeAll(() => {
			Storage.supportsSession = false;
			storage = new Storage();
		});
		test( 'creates an storage', () => expect( storage ).toBeInstanceOf( Storage ) );
		test( 'does not require any key for entries into this storage', () => {
			expect( storage.isKeyRequired ).toBe( false );
		} );
		describe( 'clone(...)', () => {
			test( 'returns a copy of the data', () => {
				const data = { a: 30, b: false, c: 'test', d: [ 8 ], e: { w: 55 } };
				const cloned = storage.clone( data );
				expect( cloned ).not.toBe( data );
				expect( cloned ).toStrictEqual( data );
			} );
		} );
		describe( 'getItem(...)', () => {
			let _data;
			beforeAll(() => {
				const key = 'a';
				storage.setItem( key, data );
				_data = storage.getItem( key );
			});
			test( 'does not get data from the session storage', () => {
				expect( mockImpls.getItem ).not.toHaveBeenCalled();
			} );
			test( 'gets the stored data', () => {
				expect( _data ).toBe( data );
				expect( _data ).toStrictEqual( data );
			} );
		} );
		describe( 'removeItem(...)', () => {
			test( 'does interact with the session storage', () => {
				storage.removeItem( 'a' );
				expect( mockImpls.removeItem ).not.toHaveBeenCalled();
			} );
		} );
		describe( 'setItem(...)', () => {
			test( 'does not interact with the session storage', () => {
				storage.setItem( 'a', data );
				expect( mockImpls.setItem ).not.toHaveBeenCalled();
			} );
		} );
	} );
} );
