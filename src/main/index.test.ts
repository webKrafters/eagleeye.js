import { AccessorResponse, Immutable } from '@webkrafters/auto-immutable';

import {
	StoreShutdownReason,
	type BaseStream,
	type IStorage,
	type Prehooks,
	type SelectorMap,
	type State,
	type Store,
	type StoreRef,
	type Stream
} from '..';

import getProperty from '@webkrafters/get-property';

import * as AutoImmutableModule from '@webkrafters/auto-immutable';

import clonedeep from '@webkrafters/clone-total';

import {
	createEagleEye,
	EagleEyeContext as EagleEyeContextClass,
	LiveStore,
	mkReadonly,
} from '.';

import { isReadonly } from '../test-artifacts/utils';

import createSourceData, {
	type SourceData
} from '../test-artifacts/data/create-state-obj';

import {
	DELETE_TAG,
	FULL_STATE_SELECTOR,
	MOVE_TAG,
	REPLACE_TAG
} from '../constants';

const { default: AutoImmutable } = AutoImmutableModule;

describe( 'EagleEyeContext', () => {
	let data : SourceData;
	let immutable : Immutable<SourceData>;
	beforeAll(() => {
		data = createSourceData();
		immutable = new AutoImmutable( data );
	});
	describe( 'creation: all parameters are optional', () => {
		test( 'can be instantiated when state data is not yet available', () => {
			expect( new EagleEyeContextClass() ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( undefined, {}, {} as IStorage<SourceData> ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( undefined, undefined, {} as IStorage<SourceData> ) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be instantiated with a known default state data', () => {
			expect( new EagleEyeContextClass<SourceData>( data, {}, {} as IStorage<SourceData> ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( data, {} ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( data, undefined, {} as IStorage<SourceData> ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( data ) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be instantiated with an existing immutable state data', () => {
			expect( new EagleEyeContextClass<SourceData>( immutable, {}, {} as IStorage<SourceData> ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( immutable, {} ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( immutable, undefined, {} as IStorage<SourceData> ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( immutable ) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be obtained through the create function when default state data unknown', () => {
			expect( createEagleEye() ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({}) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be obtained through the create function using known default state data', () => {
			expect( createEagleEye({
				value: data
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				storage: {} as IStorage<SourceData>,
				value: data
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				prehooks: {},
				storage: {} as IStorage<SourceData>,
				value: data
			}) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be obtained through the create function using an existing immutable state data', () => {
			expect( createEagleEye({
				value: immutable
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				storage: {} as IStorage<SourceData>,
				value: immutable
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				prehooks: {},
				storage: {} as IStorage<SourceData>,
				value: immutable
			}) ).toBeInstanceOf( EagleEyeContextClass );
		} );
	} );
	describe( 'accessor properties', () => {
		interface Storage extends IStorage<SourceData> { _data : SourceData }
		let storage : Storage;
		let sourceData : SourceData;
		let context : EagleEyeContextClass<SourceData>;
		let prehooks : Prehooks<SourceData>;
		beforeAll(() => {
			storage = {
				_data: undefined as unknown as SourceData,
				clone( data ){ return clonedeep( this._data ) },
				getItem(){ return this._data },
				removeItem(){ this._data = undefined as unknown as SourceData },
				setItem( key, data ){ this._data = data }
			};
			prehooks = {};
			sourceData = createSourceData();
			context = new EagleEyeContextClass( sourceData, prehooks, storage );
		});
		test( 'cache can be retrieved', () => {
			expect( context.cache ).toBeInstanceOf( Immutable );
		} );
		test( 'prehooks can be set and retrieved', () => {
			expect( context.prehooks ).toBe( prehooks );
			const newPrehooks =  {};
			context.prehooks = newPrehooks;
			expect( context.prehooks ).not.toBe( prehooks );
			expect( context.prehooks ).toBe( newPrehooks );
		} );
		test( 'storage can be set and retrieved', () => {
			const currentStorage = context.storage;
			expect( currentStorage ).toBe( storage );
			const newStorage : Storage = {
				...storage, _data: undefined as unknown as SourceData
			}
			context.storage = newStorage;
			expect( context.storage ).not.toBe( currentStorage );
			expect( context.storage ).toBe( newStorage );
		} );
		test( 'changing storage transfers value from old storage to the new', () => {
			const currentStorage = context.storage;
			const data = currentStorage.getItem( null);
			const newStorage : Storage = {
				...storage, _data: undefined as unknown as SourceData
			};
			expect( data ).not.toBeUndefined();
			expect( newStorage.getItem( null ) ).toBeUndefined();
			context.storage = newStorage;
			expect( currentStorage.getItem( null ) ).toBeUndefined();
			expect( newStorage.getItem( null ) ).toBe( data );
		} );
		test( 'external store reference can be retrieved', () => {
			expect( context.store ).toStrictEqual( expect.objectContaining({
				getState: expect.any( Function ),
				resetState: expect.any( Function ),
				setState: expect.any( Function ),
				subscribe: expect.any( Function ),
			}) );
		} );
		describe( 'external store reference', () => {
			type IStoreData = {
				color: string,
				customer: {
					name: {
						first: string,
						last: string
					}
					phone: string
				},
				price: number,
				type: string
			}
			let data : Partial<IStoreData>;
			let ctx : EagleEyeContextClass<Partial<IStoreData>>;
			beforeAll(() => {
				data = {
					color: 'Burgundy',
					customer: {
						name: { first: 'tFirst', last: 'tLast' },
						phone: null as unknown as string
					},
					price: 22.5,
					type: 'TEST TYPE'
				};
				ctx = createEagleEye({ value: data });
			});
			afterAll(() => { ctx.dispose() });
			describe( 'accessing the state', () => {
				test( 'returns entire copy of the current state by default', () => {
					const currentState = ctx.store.getState();
					expect( currentState ).not.toBe( data );
					expect( currentState ).toStrictEqual( data );
				} );
				test( 'returns only copy of the state targeted by property paths', () => {
					expect( ctx.store.getState([
						'customer.name.last',
						'type',
						'customer.phone'
					]) ).toEqual({
						customer: {
							name: { last: 'tLast' },
							phone: null
						},
						type: 'TEST TYPE'
					});
				} );
				test( 'returns entire copy of the current state if ' + FULL_STATE_SELECTOR + ' found in property paths used', () => {
					expect( ctx.store.getState([
						'customer.name.last',
						'type',
						'customer.phone',
						FULL_STATE_SELECTOR
					]) ).toEqual( data );
				} );
				describe( 'when unchanged, guarantees data consistency by ensuring that...', () => {
					function areExact( a : any, b : any ) {
						if( a !== b ) { return false };
						if( typeof a === 'object' ) {
							for( const k in a ) {
								return areExact( a[ k ], b[ k ] );
							}
						}
						return true;
					}
					test( 'same entire state is returned for all default requests', () => {
						expect( areExact(
							ctx.store.getState(),
							ctx.store.getState()
						) ).toBe( true );
					} );
					test( 'same values at property paths are returned when using property paths', () => {
						const pPaths = [ 'customer.name.last', 'type', 'customer.phone' ];
						const s1 = ctx.store.getState( pPaths );
						const s2 = ctx.store.getState( pPaths );
						for( const path of pPaths ) {
							expect( areExact(
								getProperty( s1, path )._value,
								getProperty( s2, path )._value
							) ).toBe( true );
						}
					} );
					test( 'same entire state is returned if ' + FULL_STATE_SELECTOR + ' found in property paths used', () => {
						const pPaths = [ 'customer.name.last', 'type', FULL_STATE_SELECTOR, 'customer.phone' ];
						expect( areExact(
							ctx.store.getState(),
							ctx.store.getState()
						) ).toBe( true );
					} );
				} );
				describe( 'guarantees data immutability by ensuring by...', () => {
					test( 'returning readonly state for all default requests', () => {
						expect( isReadonly( ctx.store.getState() ) ).toBe( true );
					} );
					test( 'returning readonly state for when using property paths', () => {
						expect( isReadonly( ctx.store.getState([
							'customer.name.last',
							'type',
							'customer.phone'
						]) ) ).toBe( true );
					} );
					test( 'returning entire state as readonly if ' + FULL_STATE_SELECTOR + ' found in property paths used', () => {
						expect( isReadonly( ctx.store.getState([
							'customer.name.last',
							'type',
							FULL_STATE_SELECTOR,
							'customer.phone'
						]) ) ).toBe( true );
					} );
				} );
			} );
			test( 'updates internal state', async () => {
				const currentState = ctx.store.getState();
				ctx.store.setState({ price: 45 });
				let newState = { ...data, price: 45 };
				expect( currentState ).not.toEqual( newState );
				expect( ctx.store.getState() ).toEqual( newState );
				ctx.store.resetState([ FULL_STATE_SELECTOR ]); // resets store internal state
				let currentState2 = ctx.store.getState();
				expect( currentState2 ).toStrictEqual( data );
				expect( currentState2 ).toStrictEqual( currentState );
				// alter internal state to ready for default reset feature
				ctx.store.setState({ price: 300 });
				currentState2 = ctx.store.getState();
				newState = { ...data, price: 300 };
				expect( currentState2 ).toEqual( newState );
				expect( currentState2 ).not.toEqual( data );
				// default reset results in no-operation
				ctx.store.resetState();
				const currentState3 = ctx.store.getState();
				expect( newState ).toEqual( currentState3 );
				expect( data ).not.toEqual( currentState3 );
				expect( currentState2 ).toBe( currentState3 );
			} );
			test( 'subscribes to state changes', async () => {
				const changes = { price: 45 };
				const onChangeMock = jest.fn();
				const unsub = ctx.store.subscribe( onChangeMock );
				expect( onChangeMock ).not.toHaveBeenCalled();
				ctx.store.setState( changes );
				expect( onChangeMock ).toHaveBeenCalled();
				expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual( changes );
				expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'price' ]]);
				expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual( changes );
				expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
				onChangeMock.mockClear();
				const changes2 = [
					{
						color: 'Navy',
						type: 'TEST TYPE_2'
					},
					{ customer: { name: { last: 'T_last_2' } } }
				];
				ctx.store.setState( changes2 );
				expect( onChangeMock ).toHaveBeenCalled();
				expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual( changes2 );
				expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([
					[ 'color' ],
					[ 'type' ],
					[ 'customer', 'name', 'last' ]
				]);
				expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({
					color: 'Navy',
					customer: { name: { last: 'T_last_2' } },
					type: 'TEST TYPE_2'
				});
				expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
				onChangeMock.mockClear();
				ctx.store.resetState([ FULL_STATE_SELECTOR ]);
				expect( onChangeMock ).toHaveBeenCalled();
				expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({[ REPLACE_TAG ]: data });
				expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[]]);
				expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual( data );
				expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
				onChangeMock.mockClear();
				unsub();
				ctx.store.setState( changes );
				expect( onChangeMock ).not.toHaveBeenCalled();
				ctx.store.resetState([ FULL_STATE_SELECTOR ]);
				expect( onChangeMock ).not.toHaveBeenCalled();
			} );
		} );
		test( 'change stream can be retrieved', () => {
			expect( context.stream ).toEqual( expect.any( Function ) );
		} );
		test( "invoked change stream returns a observable LiveStore 'an automatically updating store'", () => {
			expect( context.stream() ).toBeInstanceOf( LiveStore );
		} );
		describe( "change stream's LiveStore", () => {
			let data : Partial<SourceData>;
			let ctx : EagleEyeContextClass<Partial<SourceData>>;
			const selectorMapOnRender = {
				year3: 'history.places[2].year',
				isActive: 'isActive',
				tag6: 'tags[5]'
			};
			beforeAll(() => {
				data = createSourceData();
				ctx = createEagleEye({ value: data });
			});
			afterAll(() => { ctx.dispose() });
			test( 'returns a store with labeled state slices', () => {
				const store = ctx.stream({
					all: FULL_STATE_SELECTOR,
					tags: 'tags'
				});
				expect( store ).toEqual({
					data: {
						all: sourceData,
						tags: sourceData.tags
					},
					resetState: expect.any( Function ),
					setState: expect.any( Function )
				});
				store.close();
			} );
			describe( 'properties', () => {
				describe( 'store.onBeforeClose', () => {
					let ctx : EagleEyeContextClass<Partial<SourceData>>;
					beforeEach(() => {
						ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
					});
					afterEach(() =>  { ctx.dispose() });
					test( 'is a setter property accepting callback', () => {
						const store = ctx.stream();
						expect( () => store.onBeforeClose ).toThrow();
						expect(() => { store.onBeforeClose = ()=>{} }).not.toThrow();
						store.close();
					} );
					test( 'invoked at the end of live store streaming phase', () => {
						const store = ctx.stream();
						const closeHandler = jest.fn();
						store.onBeforeClose = closeHandler;
						expect( closeHandler ).not.toHaveBeenCalled();
						store.close();
						expect( closeHandler ).toHaveBeenCalled();
					} );
					test( 'invoked at the end of live store streaming phase', () => {
						const store = ctx.stream();
						const closeHandler = jest.fn();
						store.onBeforeClose = closeHandler;
						expect( closeHandler ).not.toHaveBeenCalled();
						store.close();
						expect( closeHandler ).toHaveBeenCalled();
					} );
					test( 'is invoked with a user level message at normal closure', () => {
						const store = ctx.stream();
						const closeHandler = jest.fn();
						store.onBeforeClose = closeHandler;
						store.close();
						expect( closeHandler ).toHaveBeenCalledWith( StoreShutdownReason.LOCAL );
					} );
					test( 'is invoked with a remote level message when closing due to downstream cache closure', () => {
						const cache = new AutoImmutable( createSourceData() );
						const ctx = new EagleEyeContextClass( cache );
						const store = ctx.stream();
						const closeHandler = jest.fn();
						store.onBeforeClose = closeHandler;
						expect( store.streaming ).toBe( true );
						ctx.cache.close();
						expect( store.streaming ).toBe( false );
						expect( closeHandler ).toHaveBeenCalledWith( StoreShutdownReason.REMOTE );
						ctx.dispose();
					} );
					test( 'is invoked with a remote level message when closing due to context disposal', () => {
						const cache = new AutoImmutable( createSourceData() );
						const ctx = new EagleEyeContextClass( cache );
						const store = ctx.stream();
						const closeHandler = jest.fn();
						store.onBeforeClose = closeHandler;
						expect( store.streaming ).toBe( true );
						ctx.dispose();
						expect( store.streaming ).toBe( false );
						expect( closeHandler ).toHaveBeenCalledWith( StoreShutdownReason.REMOTE );
					} );
				} );
				describe( 'store.onDataChange', () => {
					let ctx : EagleEyeContextClass<Partial<SourceData>>;
					beforeEach(() => {
						ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
					});
					afterEach(() =>  { ctx.dispose() });
					test( 'is a setter property accepting callback', () => {
						const store = ctx.stream();
						expect( () => store.onDataChange ).toThrow();
						expect(() => { store.onDataChange = ()=>{} }).not.toThrow();
						store.close();
					})
					test( 'invoked whenever store.data changes', () => {
						const selectorMap = {
							company: 'company',
							lineDigits: 'phone.line'
						};
						const store = ctx.stream( selectorMap );
						expect( store.data ).toEqual({
							company: 'VORTEXACO',
							lineDigits: '2282'
						});
						const changeHandler = jest.fn();
						store.onDataChange = changeHandler;
						expect( changeHandler ).not.toHaveBeenCalled();
						store.setState({ isActive: true }); // change to global ctx did not affect stream
						expect( store.data ).toEqual({
							company: 'VORTEXACO',
							lineDigits: '2282'
						});
						expect( changeHandler ).not.toHaveBeenCalled();
						store.setState({ phone: { line: '2300' } }); // change to global ctx affects stream
						expect( store.data ).toEqual({
							company: 'VORTEXACO',
							lineDigits: '2300'
						});
						expect( changeHandler ).toHaveBeenCalledTimes( 1 );
						changeHandler.mockClear();
						// affects stream by altering its observed selector map
						store.selectorMap = [ 'company', 'phone.line' ] as unknown as typeof selectorMap; 
						expect( store.data ).toEqual({
							1: 'VORTEXACO',
							2: '2300'
						});
						expect( changeHandler ).toHaveBeenCalledTimes( 1 );
						changeHandler.mockClear();
						store.close();
					} );
				} );
				describe( 'store.selectorMap', () => {
					let selectorMapOnRerender : typeof selectorMapOnRender & { country3 : "history.places[2].country" };
					let mockGetReturnValue : AccessorResponse<SourceData>;
					beforeAll(() => {
						selectorMapOnRerender = clonedeep( selectorMapOnRender );
						selectorMapOnRerender.country3 = 'history.places[2].country';
						mockGetReturnValue = Array.from( new Set(
							Object.values( selectorMapOnRender ).concat(
								Object.values( selectorMapOnRerender )
							)
						) ).reduce(( o : Record<string, unknown>, k ) => {
							o[ k ] = null;
							return o;
						}, {}) as typeof mockGetReturnValue;
					});
					describe( 'normal flow', () => {
						test( 'adjusts the store on selctorMap change', () => {
							const origSelectorMap = {
								all: FULL_STATE_SELECTOR,
								tags: 'tags'
							};
							type OrigSelectorMap = typeof origSelectorMap;
							const _selectorMapOnRender = {
								...selectorMapOnRender,
								company: 'company'
							};
							const store = ctx.stream( origSelectorMap );
							let _data : typeof mockGetReturnValue = store.data;
							store.onDataChange = () => { _data = store.data };
							store.selectorMap = _selectorMapOnRender as unknown as OrigSelectorMap;
							expect( Object.keys( _data ) )
								.toEqual( Object.keys( _selectorMapOnRender ));
							store.selectorMap = selectorMapOnRerender as unknown as OrigSelectorMap;
							expect( Object.keys( _data ) )
								.toEqual( Object.keys( selectorMapOnRerender ));
						});
						test( 'destroys previous and obtains new connection', () => {
							const cache = new AutoImmutable( createSourceData() );
							const connection = cache.connect();
							const disconnectSpy = jest.spyOn( connection, 'disconnect' );
							const getSpy = jest
								.spyOn( connection, 'get' )
								.mockReturnValue( mockGetReturnValue );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection )
							const cacheSpy = jest
								.spyOn( AutoImmutableModule, 'default' )
								.mockReturnValue( cache );
							const mockUnsubscribe = jest.fn();
							const mockSubscribe = jest.fn()
								.mockReturnValue( mockUnsubscribe );

							const store = ctx.stream( selectorMapOnRender );

							expect( connectSpy ).toHaveBeenCalledTimes( 3 );
							expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
							expect( disconnectSpy ).not.toHaveBeenCalled();
							expect( mockUnsubscribe ).not.toHaveBeenCalled();

							store.selectorMap = selectorMapOnRerender as unknown as typeof selectorMapOnRender;
							
							expect( connectSpy ).toHaveBeenCalledTimes( 4 );
							expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
							expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );
							expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );
							
							cacheSpy.mockRestore();

							store.close();
						});
						describe( 'when the new selectorMap is not empty', () => {
							test( 'refreshes state data', () => {
								const cache = new AutoImmutable( createSourceData() );
								const connection = cache.connect();
								const getSpy = jest
									.spyOn( connection, 'get' )
									.mockReturnValue( mockGetReturnValue );
								const connectSpy = jest
									.spyOn( cache, 'connect' )
									.mockReturnValue( connection )
								const cacheSpy = jest
									.spyOn( AutoImmutableModule, 'default' )
									.mockReturnValue( cache );
								expect( getSpy ).not.toHaveBeenCalled();

								const store = ctx.stream( selectorMapOnRender );

								expect( getSpy ).toHaveBeenCalledTimes( 2 );
								expect( getSpy.mock.calls[ 1 ] ).toEqual(
									Object.values( selectorMapOnRender )
								);
								getSpy.mockClear();

								store.selectorMap = selectorMapOnRerender;

								expect( getSpy ).toHaveBeenCalledTimes( 1 );
								expect( getSpy ).toHaveBeenCalledWith(
									...Object.values( selectorMapOnRerender )
								);

								cacheSpy.mockRestore();

								store.close();
							});
							test( 'sets up new subscription with the consumer', () => {
								const mockSubscribe = jest.fn()
								const mockUnsubscribe = jest.fn();

								class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
									public subscribe(){
										mockSubscribe();
										super.subscribe();
									}
									public unsubscribe() {
										super.unsubscribe();
										mockUnsubscribe();
									}
								}
								interface TestBaseStream extends BaseStream<SourceData> {
									<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
								}
								class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
									protected initStream() {
										this._stream = selectorMap => new TestLiveStore( this, selectorMap );
									}
								}

								const ctx = new TestEagleEyeContextClass( sourceData );

								const store = ctx.stream( selectorMapOnRender );

								expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
								expect( mockUnsubscribe ).not.toHaveBeenCalled();

								store.selectorMap = selectorMapOnRerender;

								expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
								expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

								store.close();
								
								ctx.dispose();
							});
						});
					} );
					describe( 'accepting an array of propertyPaths in place of a selector map', () => {
						test( 'produces an indexed-based context state data object', () => {
							const store = ctx.stream([
								...Object.values( selectorMapOnRender ),
								FULL_STATE_SELECTOR
							]);
							const stateSource = createSourceData();
							expect( store.data ).toStrictEqual({
								0: stateSource.history.places[ 2 ].year,
								1: stateSource.isActive,
								2: stateSource.tags[ 5 ],
								3: stateSource
							});
						} );
					} );
					describe( 'when the new selectorMap is empty', () => {
						describe( 'and existing data is not empty', () => {
							test( 'adjusts the store on selctorMap change', () => {
								const store = ctx.stream( selectorMapOnRender );
								expect( Object.keys( store.data ) )
									.toEqual( Object.keys( selectorMapOnRender ));
								store.selectorMap = {} as unknown as typeof selectorMapOnRender
								expect( store.data ).toEqual({});
							} );
							test( 'destroys previous and obtains new connection', () => {
								const cache = new AutoImmutable( createSourceData() );
								const connection = cache.connect();
								const disconnectSpy = jest.spyOn( connection, 'disconnect' );
								const getSpy = jest
									.spyOn( connection, 'get' )
									.mockReturnValue( mockGetReturnValue );
								const connectSpy = jest
									.spyOn( cache, 'connect' )
									.mockReturnValue( connection );
								const cacheSpy = jest
									.spyOn( AutoImmutableModule, 'default' )
									.mockReturnValue( cache );
								const ctx = new EagleEyeContextClass( cache );
								const streamSpy = jest
									.spyOn( EagleEyeContextClass.prototype, 'stream' )
									.mockReturnValue( new LiveStore( ctx ) );

								const store = ctx.stream( selectorMapOnRender );

								expect( connectSpy ).toHaveBeenCalledTimes( 3 );
								expect( disconnectSpy ).not.toHaveBeenCalled();

								connectSpy.mockClear();

								store.selectorMap = selectorMapOnRerender;
								
								expect( connectSpy ).toHaveBeenCalledTimes( 1 );
								expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );

								connectSpy.mockRestore();
								disconnectSpy.mockRestore();
								getSpy.mockRestore();
								cacheSpy.mockRestore();
								streamSpy.mockRestore();

								store.close();

								ctx.dispose();
							} );
							test( 'refreshes state data with empty object', async () => {
								const cache = new AutoImmutable( createSourceData() );
								const connection = cache.connect();
								const getSpy = jest
									.spyOn( connection, 'get' )
									.mockReturnValue( mockGetReturnValue );
								const connectSpy = jest
									.spyOn( cache, 'connect' )
									.mockReturnValue( connection );
								const cacheSpy = jest
									.spyOn( AutoImmutableModule, 'default' )
									.mockReturnValue( cache );
								const ctx = new EagleEyeContextClass( cache );
								const streamSpy = jest
									.spyOn( EagleEyeContextClass.prototype, 'stream' )
									.mockReturnValue( new LiveStore( ctx ) );
								expect( getSpy ).not.toHaveBeenCalled();
								
								const store = ctx.stream( selectorMapOnRender );

								expect( getSpy ).toHaveBeenCalledTimes( 2 );
								expect( getSpy.mock.calls[ 1 ] ).toEqual(
									Object.values( selectorMapOnRender )
								);
								getSpy.mockClear();

								store.selectorMap = undefined as unknown as typeof selectorMapOnRender;
								
								expect( getSpy ).not.toHaveBeenCalled();

								expect( store.data ).toEqual({});

								connectSpy.mockRestore();
								getSpy.mockRestore();
								cacheSpy.mockRestore();
								streamSpy.mockRestore();

								store.close();

								ctx.dispose();
							} );
							test( 'does not set up new subscription with the consumer', () => {
								const mockSubscribe = jest.fn()
								const mockUnsubscribe = jest.fn();

								class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
									public subscribe(){
										mockSubscribe();
										super.subscribe();
									}
									public unsubscribe() {
										super.unsubscribe();
										mockUnsubscribe();
									}
								}
								interface TestBaseStream extends BaseStream<SourceData> {
									<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
								}
								class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
									protected initStream() {
										this._stream = selectorMap => new TestLiveStore( this, selectorMap );
									}
								}

								const ctx = new TestEagleEyeContextClass( sourceData );

								const store = ctx.stream( selectorMapOnRender );

								expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
								expect( mockUnsubscribe ).not.toHaveBeenCalled();
								mockSubscribe.mockClear();

								store.selectorMap = undefined as unknown as typeof selectorMapOnRender;

								expect( mockSubscribe ).not.toHaveBeenCalled();
								expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

								store.close();

								ctx.dispose();
							} );
						} );
						describe( 'and existing data is empty', () => {
							test( 'leaves the store as-is on selctorMap change', () => {
								let _origData : typeof mockGetReturnValue = {};
								const store = ctx.stream();
								expect( Object.keys( store.data ) ).toBe( 0 );
								_origData = store.data as typeof mockGetReturnValue;
								store.selectorMap = undefined;
								expect( store.data ).toBe( _origData );
								store.selectorMap = null as unknown as undefined;
								expect( store.data ).toBe( _origData );
								store.selectorMap = {};
								expect( store.data ).toBe( _origData );
								store.selectorMap = [];
								expect( store.data ).toBe( _origData );
								store.close();
							} );
							test( 'performs no state data update', async () => {
								const cache = new AutoImmutable( createSourceData() );
								const connection = cache.connect();
								const getSpy = jest
									.spyOn( connection, 'get' )
									.mockReturnValue( mockGetReturnValue );
								const connectSpy = jest
									.spyOn( cache, 'connect' )
									.mockReturnValue( connection );
								const cacheSpy = jest
									.spyOn( AutoImmutableModule, 'default' )
									.mockReturnValue( cache );
								const ctx = new EagleEyeContextClass( cache );
								const streamSpy = jest
									.spyOn( EagleEyeContextClass.prototype, 'stream' )
									.mockReturnValue( new LiveStore( ctx ) );
								expect( getSpy ).not.toHaveBeenCalled();
								
								const store = ctx.stream();

								expect( getSpy ).not.toHaveBeenCalled();
								expect( store.data ).toEqual({});
								getSpy.mockClear();

								const existingData = store.data;

								store.selectorMap = undefined;

								expect( getSpy ).not.toHaveBeenCalled();
								expect( store.data ).toEqual( existingData );

								connectSpy.mockRestore();
								getSpy.mockRestore();
								cacheSpy.mockRestore();
								streamSpy.mockRestore();

								store.close();

								ctx.dispose();
							} );
							test( 'does not set up new subscription with the consumer', () => {
								const mockSubscribe = jest.fn()
								const mockUnsubscribe = jest.fn();

								class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
									public subscribe(){
										mockSubscribe();
										super.subscribe();
									}
									public unsubscribe() {
										super.unsubscribe();
										mockUnsubscribe();
									}
								}
								interface TestBaseStream extends BaseStream<SourceData> {
									<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
								}
								class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
									protected initStream() {
										this._stream = selectorMap => new TestLiveStore( this, selectorMap );
									}
								}

								const ctx = new TestEagleEyeContextClass( sourceData );

								const store = ctx.stream();

								expect( mockSubscribe ).not.toHaveBeenCalled();
								expect( mockUnsubscribe ).not.toHaveBeenCalled();

								store.selectorMap = {};

								expect( mockSubscribe ).not.toHaveBeenCalled();
								expect( mockUnsubscribe ).not.toHaveBeenCalled();

								store.close();

								ctx.dispose();
							} );
							describe( 'and previous property path is empty', () => {
								test( 'skips refreshing connection: no previous connections to the consumer existed', () => {
									const mockSubscribe = jest.fn()
									const mockUnsubscribe = jest.fn();

									class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
										public subscribe(){
											mockSubscribe();
											super.subscribe();
										}
										public unsubscribe() {
											super.unsubscribe();
											mockUnsubscribe();
										}
									}
									interface TestBaseStream extends BaseStream<SourceData> {
										<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
									}
									class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
										protected initStream() {
											this._stream = selectorMap => new TestLiveStore( this, selectorMap );
										}
									}

									const cache = new AutoImmutable( createSourceData() );
									const connection = cache.connect();
									const disconnectSpy = jest.spyOn( connection, 'disconnect' );
									const getSpy = jest
										.spyOn( connection, 'get' )
										.mockReturnValue( mockGetReturnValue );
									const connectSpy = jest
										.spyOn( cache, 'connect' )
										.mockReturnValue( connection );

									const ctx = new TestEagleEyeContextClass( cache );

									const store = ctx.stream( selectorMapOnRender );

									expect( connectSpy ).toHaveBeenCalledTimes( 3 );
									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( disconnectSpy ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).not.toHaveBeenCalled();
									connectSpy.mockClear();

									store.selectorMap = {} as unknown as typeof selectorMapOnRender;

									expect( connectSpy ).not.toHaveBeenCalled();
									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( disconnectSpy ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									connectSpy.mockRestore();
									disconnectSpy.mockRestore();
									getSpy.mockRestore();

									store.close();

									ctx.dispose();
								} );
							} );
						} );
					} );
				} );
				describe( 'store.streaming', () => {
					test( 'is flag set for a live store versus a closed store', () => {
						const store = ctx.stream();
						expect( store.streaming ).toBe( true );
						store.close();
						expect( store.streaming ).toBe( false );
					} );
				} );
			} );
			describe( 'store.close', () => {
				let ctx : EagleEyeContextClass<Partial<SourceData>>;
				beforeEach(() => {
					ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
				});
				afterEach(() =>  { ctx.dispose() });
				test( 'severs connection to the global context streaming', () => {
					const sourceData : Partial<SourceData> = createSourceData();
					const cache = new AutoImmutable( sourceData );
					const connection = cache.connect();
					const getSpy = jest.spyOn( connection, 'get' );
					const setSpy = jest.spyOn( connection, 'set' );
					const connectSpy = jest.spyOn( cache, 'connect' )
						.mockReturnValue( connection );
					const ctx = new EagleEyeContextClass( cache );
					const selectorMap = {
						regHour: 'registered.time.hours'
					};
					const dataChangeHandler = jest.fn();
					const store = ctx.stream( selectorMap );
					store.onDataChange = dataChangeHandler;
					expect( store.data ).toEqual({ reghHour: 9 });
					setSpy.mockClear();
					getSpy.mockClear();
					store.setState({
						registered: {
							month: 7,
							time: {
								hours: 22,
								minutes: 5
							},
							year: 2026
						}
					});
					expect( dataChangeHandler ).toHaveBeenCalled();
					expect( setSpy ).toHaveBeenCalled();
					expect( getSpy ).toHaveBeenCalled();
					expect( store.data ).toEqual({ reghHour: 22 });
					dataChangeHandler.mockClear();
					setSpy.mockClear();
					getSpy.mockClear();
					// after diposal, the store has no access to the context 
					ctx.dispose();
					store.setState({
						registered: {
							month: 3,
							time: {
								hours: 16
							}
						}
					});
					expect( dataChangeHandler ).not.toHaveBeenCalled();
					expect( setSpy ).not.toHaveBeenCalled();
					expect( getSpy ).not.toHaveBeenCalled();
					expect( store.data ).toEqual({ reghHour: 22 }); // instead of 16
					
					setSpy.mockRestore();
					getSpy.mockRestore();
					connectSpy.mockRestore();

					ctx.dispose();

				} );
			} );
			describe( 'store.data', () => {
				let ctx : EagleEyeContextClass<Partial<SourceData>>;
				beforeEach(() => {
					ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
				});
				afterEach(() => { ctx.dispose() });
				test( 'carries the latest state data as referenced by the selectorMap', () => {
					const store = ctx.stream({
						city3: 'history.places[2].city',
						country3: 'history.places[2].country',
						friends: 'friends',
						year3: 'history.places[2].year',
						isActive: 'isActive',
						tag6: 'tags[5]',
						tag7: 'tags[6]',
						tags: 'tags'
					});
					const defaultState = createSourceData();
					const expectedValue = {
						city3: defaultState.history.places[ 2 ].city,
						country3: defaultState.history.places[ 2 ].country,
						friends: defaultState.friends,
						year3: defaultState.history.places[ 2 ].year,
						isActive: defaultState.isActive,
						tag6: defaultState.tags[ 5 ],
						tag7: defaultState.tags[ 6 ],
						tags: defaultState.tags
					};
					expect( store.data ).toEqual( expectedValue );
					store.setState({
						friends: { [ MOVE_TAG ]: [ -1, 1 ] } as unknown as Array<any>,
						isActive: true,
						history: {
							places: {
								2: {
									city: 'Marakesh',
									country: 'Morocco'
								}  as SourceData["history"]["places"][0]
							} as unknown as SourceData["history"]["places"]
						},
						tags: { [ DELETE_TAG ]: [ 3, 5 ] } as unknown as SourceData["tags"]
					});
					expect( store.data ).toEqual({
						...expectedValue,
						city3: 'Marakesh',
						country3: 'Morocco',
						friends: [ 0, 2, 1 ].map( i => defaultState.friends[ i ] ),
						isActive: true,
						tag6: undefined,
						tag7: undefined,
						tags: [ 0, 1, 2, 4, 6 ].map( i => defaultState.tags[ i ] )
					});
					store.close();
				} );
				test( 'holds the complete current state object whenever `@@STATE` entry appears in the selectorMap', () => {
					const store = ctx.stream({
						city3: 'history.places[2].city',
						country3: 'history.places[2].country',
						year3: 'history.places[2].year',
						isActive: 'isActive',
						tag6: 'tags[5]',
						tag7: 'tags[6]',
						state: '@@STATE'
					});
					const defaultState = createSourceData();
					const expectedValue = {
						city3: defaultState.history.places[ 2 ].city,
						country3: defaultState.history.places[ 2 ].country,
						year3: defaultState.history.places[ 2 ].year,
						isActive: defaultState.isActive,
						tag6: defaultState.tags[ 5 ],
						tag7: defaultState.tags[ 6 ],
						state: defaultState
					};
					expect( store.data ).toEqual( expectedValue );
					store.setState({
						isActive: true,
						history: {
							places: {
								2: {
									city: 'Marakesh',
									country: 'Morocco'
								}
							}
						}
					} as unknown as SourceData );
					const updatedDataEquiv = createSourceData();
					updatedDataEquiv.history.places[ 2 ].city = 'Marakesh';
					updatedDataEquiv.history.places[ 2 ].country = 'Morocco';
					updatedDataEquiv.isActive = true;
					expect( store.data ).toEqual({
						...expectedValue,
						city3: 'Marakesh',
						country3: 'Morocco',
						isActive: true,
						state: updatedDataEquiv
					});
					store.close();
				} );
				test( 'holds an empty object when no renderKeys provided ', async () => {
					const store = ctx.stream();
					expect( store.data ).toEqual({});
					store.setState({ // can still update state
						isActive: true,
						history: {
							places: {
								2: {
									city: 'Marakesh',
									country: 'Morocco'
								}
							} as unknown as SourceData["history"]["places"]
						} as SourceData["history"]
					});
					expect( store.data ).toEqual({});
					store.close();
				} );
			} );
			describe( 'store.resetState', () => {
				let ctx : EagleEyeContextClass<Partial<SourceData>>;
				beforeEach(() => {
					ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
				});
				afterEach(() => { ctx.dispose() });
				describe( 'when selectorMap is present in the consumer', () => {
					describe( 'and called with own property paths arguments to reset', () => {
						test( 'resets with original slices and removes non-original slices for entries found in property paths', () => {
							const sourceData = createSourceData();
							const cache = new AutoImmutable( sourceData );
							const connection = cache.connect();
							const setSpy = jest.spyOn( connection, 'set' );
							const connectSpy = jest.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const ctx = new EagleEyeContextClass( cache );
							const store = ctx.stream( selectorMapOnRender );
							setSpy.mockClear();
							store.resetState([ 'blatant', 'company', 'xylophone', 'yodellers', 'zenith' ]);
							expect( setSpy ).toHaveBeenCalledTimes( 1 );
							expect( setSpy.mock.calls[ 0 ][ 0 ] ).toEqual({
								[ DELETE_TAG ]: [ 'blatant', 'xylophone', 'yodellers', 'zenith' ],
								company: { [ REPLACE_TAG ]: sourceData.company }
							});
							connectSpy.mockRestore();
							setSpy.mockRestore();

							store.close();
							ctx.dispose();
						} );
					} );
					describe( 'and called with NO own property paths argument to reset', () => {
						test( 'calculates setstate changes using state slice matching property paths derived from the selectorMap', () => {
							const sourceData = createSourceData();
							const cache = new AutoImmutable( sourceData );
							const connection = cache.connect();
							const setSpy = jest.spyOn( connection, 'set' );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const ctx = new EagleEyeContextClass( cache );
							const store = ctx.stream( selectorMapOnRender );
							setSpy.mockClear();
							store.resetState();
							expect( setSpy ).toHaveBeenCalledTimes( 1 );
							expect( setSpy.mock.calls[ 0 ][ 0 ] ).toEqual({
								history: {
									places: {
									    2: {
									    	year: {
									    		[ REPLACE_TAG ]: sourceData.history.places[ 2 ].year,
									      	},
									    },
									},
								},
								isActive: {
									[ REPLACE_TAG ]: sourceData.isActive
								},
								tags: {
									5: {
										[ REPLACE_TAG ]: sourceData.tags[ 5 ]
									},
								},
							});
							connectSpy.mockRestore();
							setSpy.mockRestore();

							store.close();

							ctx.dispose();
						} );
					} );
				} );
				describe( 'when selectorMap is NOT present in the consumer', () => {
					describe( 'and called with own property paths arguments to reset', () => {
						test( 'resets with original slices and removes non-original slices for entries found in property paths', () => {
							const sourceData = createSourceData();
							const cache = new AutoImmutable( sourceData );
							const connection = cache.connect();
							const setSpy = jest.spyOn( connection, 'set' );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const ctx = new EagleEyeContextClass( cache );
							const store = ctx.stream();
							setSpy.mockClear();
							store.resetState([ 'blatant', 'company', 'xylophone', 'yodellers', 'zenith' ]);
							expect( setSpy ).toHaveBeenCalledTimes( 1 );
							expect( setSpy.mock.calls[ 0 ][ 0 ] ).toEqual({
								[ DELETE_TAG ]: [ 'blatant','xylophone','yodellers','zenith' ],
								company: {
									[ REPLACE_TAG ]: sourceData.company
								},
							});
							connectSpy.mockRestore();
							setSpy.mockRestore();

							store.close();

							ctx.dispose();
						} );
					} );
					describe( 'and called with NO own property paths arguments to reset', () => {
						test( 'calculates resetstate changes using no property paths -- the consumer applies no store reset', () => {
							const sourceData = createSourceData();
							const cache = new AutoImmutable( sourceData );
							const connection = cache.connect();
							const setSpy = jest.spyOn( connection, 'set' );
							const connectSpy = jest.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const ctx = new EagleEyeContextClass( cache );
							const store = ctx.stream();
							setSpy.mockClear();
							store.resetState();

							expect( setSpy ).toHaveBeenCalledTimes( 1 );
							expect( setSpy.mock.calls[ 0 ][ 0 ] ).toEqual({});

							connectSpy.mockRestore();
							setSpy.mockRestore();

							store.close();

							ctx.dispose();
						} );
					} );
				} );
			} );
			describe( 'store.selectorMap', () => {
				let selectorMapOnRerender : typeof selectorMapOnRender & { country3 : "history.places[2].country" };
				let mockGetReturnValue : AccessorResponse<SourceData>;
				beforeAll(() => {
					selectorMapOnRerender = clonedeep( selectorMapOnRender );
					selectorMapOnRerender.country3 = 'history.places[2].country';
					mockGetReturnValue = Array.from( new Set(
						Object.values( selectorMapOnRender ).concat(
							Object.values( selectorMapOnRerender )
						)
					) ).reduce(( o : Record<string, unknown>, k ) => {
						o[ k ] = null;
						return o;
					}, {}) as typeof mockGetReturnValue;
				});
				describe( 'normal flow', () => {
					test( 'adjusts the store on selctorMap change', () => {
						const origSelectorMap = {
							all: FULL_STATE_SELECTOR,
							tags: 'tags'
						};
						type OrigSelectorMap = typeof origSelectorMap;
						const _selectorMapOnRender = {
							...selectorMapOnRender,
							company: 'company'
						};
						const store = ctx.stream( origSelectorMap );
						let _data : typeof mockGetReturnValue = store.data;
						store.onDataChange = () => { _data = store.data };
						store.selectorMap = _selectorMapOnRender as unknown as OrigSelectorMap;
						expect( Object.keys( _data ) )
							.toEqual( Object.keys( _selectorMapOnRender ));
						store.selectorMap = selectorMapOnRerender as unknown as OrigSelectorMap;
						expect( Object.keys( _data ) )
							.toEqual( Object.keys( selectorMapOnRerender ));
					});
					test( 'destroys previous and obtains new connection', () => {
						const cache = new AutoImmutable( createSourceData() );
						const connection = cache.connect();
						const disconnectSpy = jest.spyOn( connection, 'disconnect' );
						const getSpy = jest
							.spyOn( connection, 'get' )
							.mockReturnValue( mockGetReturnValue );
						const connectSpy = jest
							.spyOn( cache, 'connect' )
							.mockReturnValue( connection )
						const cacheSpy = jest
							.spyOn( AutoImmutableModule, 'default' )
							.mockReturnValue( cache );
						const mockUnsubscribe = jest.fn();
						const mockSubscribe = jest.fn()
							.mockReturnValue( mockUnsubscribe );

						const store = ctx.stream( selectorMapOnRender );

						expect( connectSpy ).toHaveBeenCalledTimes( 3 );
						expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
						expect( disconnectSpy ).not.toHaveBeenCalled();
						expect( mockUnsubscribe ).not.toHaveBeenCalled();

						store.selectorMap = selectorMapOnRerender as unknown as typeof selectorMapOnRender;
						
						expect( connectSpy ).toHaveBeenCalledTimes( 4 );
						expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
						expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );
						expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );
						
						cacheSpy.mockRestore();

						store.close();
					});
					describe( 'when the new selectorMap is not empty', () => {
						test( 'refreshes state data', () => {
							const cache = new AutoImmutable( createSourceData() );
							const connection = cache.connect();
							const getSpy = jest
								.spyOn( connection, 'get' )
								.mockReturnValue( mockGetReturnValue );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection )
							const cacheSpy = jest
								.spyOn( AutoImmutableModule, 'default' )
								.mockReturnValue( cache );
							expect( getSpy ).not.toHaveBeenCalled();

							const store = ctx.stream( selectorMapOnRender );

							expect( getSpy ).toHaveBeenCalledTimes( 2 );
							expect( getSpy.mock.calls[ 1 ] ).toEqual(
								Object.values( selectorMapOnRender )
							);
							getSpy.mockClear();

							store.selectorMap = selectorMapOnRerender;

							expect( getSpy ).toHaveBeenCalledTimes( 1 );
							expect( getSpy ).toHaveBeenCalledWith(
								...Object.values( selectorMapOnRerender )
							);

							cacheSpy.mockRestore();

							store.close();
						});
						test( 'sets up new subscription with the consumer', () => {
							const mockSubscribe = jest.fn()
							const mockUnsubscribe = jest.fn();

							class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
								public subscribe(){
									mockSubscribe();
									super.subscribe();
								}
								public unsubscribe() {
									super.unsubscribe();
									mockUnsubscribe();
								}
							}
							interface TestBaseStream extends BaseStream<SourceData> {
								<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
							}
							class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
								protected initStream() {
									this._stream = selectorMap => new TestLiveStore( this, selectorMap );
								}
							}

							const ctx = new TestEagleEyeContextClass( sourceData );

							const store = ctx.stream( selectorMapOnRender );

							expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
							expect( mockUnsubscribe ).not.toHaveBeenCalled();

							store.selectorMap = selectorMapOnRerender;

							expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
							expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

							store.close();
							
							ctx.dispose();
						});
					});
				} );
				describe( 'accepting an array of propertyPaths in place of a selector map', () => {
					test( 'produces an indexed-based context state data object', () => {
						const store = ctx.stream([
							...Object.values( selectorMapOnRender ),
							FULL_STATE_SELECTOR
						]);
						const stateSource = createSourceData();
						expect( store.data ).toStrictEqual({
							0: stateSource.history.places[ 2 ].year,
							1: stateSource.isActive,
							2: stateSource.tags[ 5 ],
							3: stateSource
						});
					} );
				} );
				describe( 'when the new selectorMap is empty', () => {
					describe( 'and existing data is not empty', () => {
						test( 'adjusts the store on selctorMap change', () => {
							const store = ctx.stream( selectorMapOnRender );
							expect( Object.keys( store.data ) )
								.toEqual( Object.keys( selectorMapOnRender ));
							store.selectorMap = {} as unknown as typeof selectorMapOnRender
							expect( store.data ).toEqual({});
						} );
						test( 'destroys previous and obtains new connection', () => {
							const cache = new AutoImmutable( createSourceData() );
							const connection = cache.connect();
							const disconnectSpy = jest.spyOn( connection, 'disconnect' );
							const getSpy = jest
								.spyOn( connection, 'get' )
								.mockReturnValue( mockGetReturnValue );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const cacheSpy = jest
								.spyOn( AutoImmutableModule, 'default' )
								.mockReturnValue( cache );
							const ctx = new EagleEyeContextClass( cache );
							const streamSpy = jest
								.spyOn( EagleEyeContextClass.prototype, 'stream' )
								.mockReturnValue( new LiveStore( ctx ) );

							const store = ctx.stream( selectorMapOnRender );

							expect( connectSpy ).toHaveBeenCalledTimes( 3 );
							expect( disconnectSpy ).not.toHaveBeenCalled();

							connectSpy.mockClear();

							store.selectorMap = selectorMapOnRerender;
							
							expect( connectSpy ).toHaveBeenCalledTimes( 1 );
							expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );

							connectSpy.mockRestore();
							disconnectSpy.mockRestore();
							getSpy.mockRestore();
							cacheSpy.mockRestore();
							streamSpy.mockRestore();

							store.close();

							ctx.dispose();
						} );
						test( 'refreshes state data with empty object', async () => {
							const cache = new AutoImmutable( createSourceData() );
							const connection = cache.connect();
							const getSpy = jest
								.spyOn( connection, 'get' )
								.mockReturnValue( mockGetReturnValue );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const cacheSpy = jest
								.spyOn( AutoImmutableModule, 'default' )
								.mockReturnValue( cache );
							const ctx = new EagleEyeContextClass( cache );
							const streamSpy = jest
								.spyOn( EagleEyeContextClass.prototype, 'stream' )
								.mockReturnValue( new LiveStore( ctx ) );
							expect( getSpy ).not.toHaveBeenCalled();
							
							const store = ctx.stream( selectorMapOnRender );

							expect( getSpy ).toHaveBeenCalledTimes( 2 );
							expect( getSpy.mock.calls[ 1 ] ).toEqual(
								Object.values( selectorMapOnRender )
							);
							getSpy.mockClear();

							store.selectorMap = undefined as unknown as typeof selectorMapOnRender;
							
							expect( getSpy ).not.toHaveBeenCalled();

							expect( store.data ).toEqual({});

							connectSpy.mockRestore();
							getSpy.mockRestore();
							cacheSpy.mockRestore();
							streamSpy.mockRestore();

							store.close();

							ctx.dispose();
						} );
						test( 'does not set up new subscription with the consumer', () => {
							const mockSubscribe = jest.fn()
							const mockUnsubscribe = jest.fn();

							class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
								public subscribe(){
									mockSubscribe();
									super.subscribe();
								}
								public unsubscribe() {
									super.unsubscribe();
									mockUnsubscribe();
								}
							}
							interface TestBaseStream extends BaseStream<SourceData> {
								<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
							}
							class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
								protected initStream() {
									this._stream = selectorMap => new TestLiveStore( this, selectorMap );
								}
							}

							const ctx = new TestEagleEyeContextClass( sourceData );

							const store = ctx.stream( selectorMapOnRender );

							expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
							expect( mockUnsubscribe ).not.toHaveBeenCalled();
							mockSubscribe.mockClear();

							store.selectorMap = undefined as unknown as typeof selectorMapOnRender;

							expect( mockSubscribe ).not.toHaveBeenCalled();
							expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

							store.close();

							ctx.dispose();
						} );
					} );
					describe( 'and existing data is empty', () => {
						test( 'leaves the store as-is on selctorMap change', () => {
							let _origData : typeof mockGetReturnValue = {};
							const store = ctx.stream();
							expect( Object.keys( store.data ) ).toBe( 0 );
							_origData = store.data as typeof mockGetReturnValue;
							store.selectorMap = undefined;
							expect( store.data ).toBe( _origData );
							store.selectorMap = null as unknown as undefined;
							expect( store.data ).toBe( _origData );
							store.selectorMap = {};
							expect( store.data ).toBe( _origData );
							store.selectorMap = [];
							expect( store.data ).toBe( _origData );
							store.close();
						} );
						test( 'performs no state data update', async () => {
							const cache = new AutoImmutable( createSourceData() );
							const connection = cache.connect();
							const getSpy = jest
								.spyOn( connection, 'get' )
								.mockReturnValue( mockGetReturnValue );
							const connectSpy = jest
								.spyOn( cache, 'connect' )
								.mockReturnValue( connection );
							const cacheSpy = jest
								.spyOn( AutoImmutableModule, 'default' )
								.mockReturnValue( cache );
							const ctx = new EagleEyeContextClass( cache );
							const streamSpy = jest
								.spyOn( EagleEyeContextClass.prototype, 'stream' )
								.mockReturnValue( new LiveStore( ctx ) );
							expect( getSpy ).not.toHaveBeenCalled();
							
							const store = ctx.stream();

							expect( getSpy ).not.toHaveBeenCalled();
							expect( store.data ).toEqual({});
							getSpy.mockClear();

							const existingData = store.data;

							store.selectorMap = undefined;

							expect( getSpy ).not.toHaveBeenCalled();
							expect( store.data ).toEqual( existingData );

							connectSpy.mockRestore();
							getSpy.mockRestore();
							cacheSpy.mockRestore();
							streamSpy.mockRestore();

							store.close();

							ctx.dispose();
						} );
						test( 'does not set up new subscription with the consumer', () => {
							const mockSubscribe = jest.fn()
							const mockUnsubscribe = jest.fn();

							class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
								public subscribe(){
									mockSubscribe();
									super.subscribe();
								}
								public unsubscribe() {
									super.unsubscribe();
									mockUnsubscribe();
								}
							}
							interface TestBaseStream extends BaseStream<SourceData> {
								<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
							}
							class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
								protected initStream() {
									this._stream = selectorMap => new TestLiveStore( this, selectorMap );
								}
							}

							const ctx = new TestEagleEyeContextClass( sourceData );

							const store = ctx.stream();

							expect( mockSubscribe ).not.toHaveBeenCalled();
							expect( mockUnsubscribe ).not.toHaveBeenCalled();

							store.selectorMap = {};

							expect( mockSubscribe ).not.toHaveBeenCalled();
							expect( mockUnsubscribe ).not.toHaveBeenCalled();

							store.close();

							ctx.dispose();
						} );
						describe( 'and previous property path is empty', () => {
							test( 'skips refreshing connection: no previous connections to the consumer existed', () => {
								const mockSubscribe = jest.fn()
								const mockUnsubscribe = jest.fn();

								class TestLiveStore<S extends SelectorMap> extends LiveStore<SourceData,S>{
									public subscribe(){
										mockSubscribe();
										super.subscribe();
									}
									public unsubscribe() {
										super.unsubscribe();
										mockUnsubscribe();
									}
								}
								interface TestBaseStream extends BaseStream<SourceData> {
									<S extends SelectorMap>(selectorMap : S) : TestLiveStore<S>;
								}
								class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
									protected initStream() {
										this._stream = selectorMap => new TestLiveStore( this, selectorMap );
									}
								}

								const cache = new AutoImmutable( createSourceData() );
								const connection = cache.connect();
								const disconnectSpy = jest.spyOn( connection, 'disconnect' );
								const getSpy = jest
									.spyOn( connection, 'get' )
									.mockReturnValue( mockGetReturnValue );
								const connectSpy = jest
									.spyOn( cache, 'connect' )
									.mockReturnValue( connection );

								const ctx = new TestEagleEyeContextClass( cache );

								const store = ctx.stream( selectorMapOnRender );

								expect( connectSpy ).toHaveBeenCalledTimes( 3 );
								expect( mockSubscribe ).not.toHaveBeenCalled();
								expect( disconnectSpy ).not.toHaveBeenCalled();
								expect( mockUnsubscribe ).not.toHaveBeenCalled();
								connectSpy.mockClear();

								store.selectorMap = {} as unknown as typeof selectorMapOnRender;

								expect( connectSpy ).not.toHaveBeenCalled();
								expect( mockSubscribe ).not.toHaveBeenCalled();
								expect( disconnectSpy ).not.toHaveBeenCalled();
								expect( mockUnsubscribe ).not.toHaveBeenCalled();

								connectSpy.mockRestore();
								disconnectSpy.mockRestore();
								getSpy.mockRestore();

								store.close();

								ctx.dispose();
							} );
						} );
					} );
				} );
			} );
			describe( 'store.setState', () => {
				let ctx : EagleEyeContextClass<Partial<SourceData>>;
				beforeEach(() => {
					ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
				});
				afterEach(() =>  { ctx.dispose() });
				test( 'commits any updates to the context', () => {
					const store = ctx.stream();
					const defaultState = createSourceData();
					expect( store.data ).toEqual({}); // no selectormap under observation
					expect( ctx.store.getState() ).toEqual( defaultState );
					store.setState({
						friends: { [ MOVE_TAG ]: [ -1, 1 ] } as unknown as Array<any>,
						isActive: true,
						history: {
							places: {
								2: {
									city: 'Marakesh',
									country: 'Morocco'
								}  as SourceData["history"]["places"][0]
							} as unknown as SourceData["history"]["places"]
						},
						tags: { [ DELETE_TAG ]: [ 3, 5 ] } as unknown as SourceData["tags"]
					});
					const expectedValue = { ...defaultState };
					expectedValue.friends = [ 0, 2, 1 ].map( i => defaultState.friends[ i ] );
					expectedValue.history.places[ 2 ].city = 'Marakesh';
					expectedValue.history.places[ 2 ].country = 'Morocco';
					expectedValue.isActive = true;
					expectedValue.tags = [ 0, 1, 2, 4, 6 ].map( i => defaultState.tags[ i ] );
					expect( ctx.store.getState() ).toEqual( expectedValue );
					expect( store.data ).toEqual({}); // no selectormap under observation
					store.close();
				});
			} );
		} );
	} );
} );


// +++++++++++



describe( 'ReactObservableContext', () => {
	test( 'throws usage error on attempts to use context store outside of the Provider component tree', () => {
		// note: TallyDisplay component utilizes the ReactObservableContext store
		expect(() => render( <TallyDisplay /> )).toThrow( UsageError );
	} );
	describe( 'store updates from within the Provider tree', () => {
		describe( 'updates only subscribed components', () => {
			describe( 'using connected store subscribers', () => {
				test( 'scenario 1', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithConnectedChildren /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Price:' ), { target: { value: '123' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update price' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.PriceSticker ).toBe( 1 );
						expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'scenario 2', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithConnectedChildren /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Color:' ), { target: { value: 'Navy' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update color' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.ProductDescription ).toBe( 1 );
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'scenario 3', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithConnectedChildren /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 );
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'does not render subscribed components for resubmitted changes', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithConnectedChildren /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.TallyDisplay ).toBe( 0 ); // unaffected: no new product type data
					});
					cleanupPerfTest();
				} );
			} );
	 		describe( 'using pure-component store subscribers', () => {
				test( 'scenario 1', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithPureChildren /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Price:' ), { target: { value: '123' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update price' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.PriceSticker ).toBe( 1 );
						expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for price data
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'scenario 2', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithPureChildren /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Color:' ), { target: { value: 'Navy' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update color' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.ProductDescription ).toBe( 1 );
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product color data
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'scenario 3', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithPureChildren /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 );
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'does not render subscribed components for resubmitted changes', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppWithPureChildren /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 );
						expect( netCount.Editor ).toBe( 0 );
						expect( netCount.PriceSticker ).toBe( 0 );
						expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.Reset ).toBe( 0 );
						expect( netCount.TallyDisplay ).toBe( 0 ); // unaffected: no new product type data
					});
					cleanupPerfTest();
				} );
			} );
			describe( 'using non pure-component store subscribers', () => {
				test( 'scenario 1', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppNormal /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Price:' ), { target: { value: '123' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update price' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product price data
						expect( netCount.PriceSticker ).toBe( 1 );
						expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no use for product price data
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'scenario 2', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppNormal /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Color:' ), { target: { value: 'Navy' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update color' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product price data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product price data
						expect( netCount.ProductDescription ).toBe( 1 );
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'scenario 3', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppNormal /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 );
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 );
					});
					cleanupPerfTest();
				} );
				test( 'does not render resubmitted changes', async () => {
					const { renderCount } : PerfValue = perf( React );
					render( <AppNormal /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 );
						expect( netCount.Editor ).toBe( 0 );
						expect( netCount.PriceSticker ).toBe( 0 );
						expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no new product type data
						expect( netCount.Reset ).toBe( 0 );
						expect( netCount.TallyDisplay ).toBe( 0 ); // unaffected: no new product type data
					});
					cleanupPerfTest();
				} );
			} );
		} );
	} );
	describe( 'store updates from outside the Provider tree', () => {
		describe( 'with connected component children', () => {
			test( 'only re-renders Provider children affected by the Provider parent prop change', async () => {
				const { renderCount } : PerfValue = perf( React );
				render( <AppWithConnectedChildren /> );
				let baseRenderCount : Record<string,any>;
				await wait(() => { baseRenderCount = transformRenderCount( renderCount ); });
				fireEvent.keyUp( screen.getByLabelText( 'Type:' ), { target: { value: 'A' } } );
				await wait(() => {
					const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
					expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.ProductDescription ).toBe( 1 );
					expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.TallyDisplay ).toBe( 1 );
				});
				cleanupPerfTest();
			} );
			test( 'only re-renders parts of the Provider tree directly affected by the Provider parent state update', async () => {
				const { renderCount } : PerfValue = perf( React );
				render( <AppWithConnectedChildren /> );
				let baseRenderCount : Record<string,any>;
				await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
				fireEvent.keyUp( screen.getByLabelText( '$', {
					key: '5',
					code: 'Key5'
				} as SelectorMatcherOptions ) );
				await wait(() => {
					const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
					expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.PriceSticker ).toBe( 1 );
					expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.TallyDisplay ).toBe( 1 );
				});
				cleanupPerfTest();
			} );
	 	} );
		describe( 'with pure-component children', () => {
			test( 'only re-renders Provider children affected by the Provider parent prop change', async () => {
				const { renderCount } : PerfValue = perf( React );
				render( <AppWithPureChildren /> );
				let baseRenderCount : Record<string,any>;
				await wait(() => { baseRenderCount = transformRenderCount( renderCount ); });
				fireEvent.keyUp( screen.getByLabelText( 'Type:' ), { target: { value: 'A' } } );
				await wait(() => {
					const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
					expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.ProductDescription ).toBe( 1 );
					expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.TallyDisplay ).toBe( 1 );
				});
				cleanupPerfTest();
			} );
			test( 'only re-renders parts of the Provider tree directly affected by the Provider parent state update', async () => {
				const { renderCount } : PerfValue = perf( React );
				render( <AppWithPureChildren /> );
				let baseRenderCount : Record<string,any>;
				await wait(() => { baseRenderCount = transformRenderCount( renderCount ); });
				fireEvent.keyUp( screen.getByLabelText( '$', { key: '5', code: 'Key5' } as SelectorMatcherOptions ) );
				await wait(() => {
					const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
					expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.PriceSticker ).toBe( 1 );
					expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.TallyDisplay ).toBe( 1 );
				});
				cleanupPerfTest();
			} );
		} );
		describe( 'with non pure-component children ', () => {
			test( 'only re-renders Provider children affected by the Provider parent prop change', async () => {
				const { renderCount } : PerfValue = perf( React );
				render( <AppNormal /> );
				let baseRenderCount : Record<string,any>;
				await wait(() => { baseRenderCount = transformRenderCount( renderCount ); });
				fireEvent.keyUp( screen.getByLabelText( 'Type:' ), { target: { value: 'A' } } );
				await wait(() => {
					const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
					expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
					expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
					expect( netCount.ProductDescription ).toBe( 1 );
					expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
					expect( netCount.TallyDisplay ).toBe( 1 );
				});
				cleanupPerfTest();
			} );
			test( 'oonly re-renders parts of the Provider tree directly affected by the Provider parent state update', async () => {
				const { renderCount } : PerfValue = perf( React );
				render( <AppNormal /> );
				let baseRenderCount : Record<string,any>;
				await wait(() => { baseRenderCount = transformRenderCount( renderCount ); });
				fireEvent.keyUp( screen.getByLabelText( '$', { key: '5', code: 'Key5' } as SelectorMatcherOptions ) );
				await wait(() => {
					const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
					expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
					expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.PriceSticker ).toBe( 1 );
					expect( netCount.ProductDescription ).toBe( 0 ); // unaffected: no use for product price data
					expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
					expect( netCount.TallyDisplay ).toBe( 1 );
				});
				cleanupPerfTest();
			} );
		} );
	} );
	describe( 'accessing store externally through its provider', () => {
		const sourceData = createSourceData();
		let storeRef : React.RefObject<StoreRef<Partial<SourceData>>>;
		let EagleEyeContext : EagleEyeContextClass<Partial<SourceData>>;
		let TestComp : React.FC<{children?:React.ReactNode}>;
		beforeAll(() => {
			EagleEyeContext = createEagleEye();
			TestComp = ({ children }) => {
				const ref = useRef<StoreRef<Partial<SourceData>>>( null );
				useEffect(() => { storeRef = ref }, []);
				return (
					<EagleEyeContext.Provider
						children={ children }
						ref={ ref }
						value={ sourceData }
					/>
				)
			}
		});
		test( 'is successful', () => {
			storeRef = undefined as unknown as typeof storeRef;
			render( <TestComp /> );
			expect( storeRef.current )
				.toEqual( expect.objectContaining({
					getState: expect.any( Function ),
					resetState: expect.any( Function ),
					setState: expect.any( Function ),
					subscribe: expect.any( Function )
				})
			);	
		});
		test( 'can read the current store data', async () => {
			storeRef = undefined as unknown as typeof storeRef;
			const NEW_AGE = 71;
			const Child =  connect( EagleEyeContext )(({ setState }) => {
				const setAge = React.useCallback(
					() => setState({ age: NEW_AGE }),
					[ setState ]
				);
				return ( <button value="set age" onClick={ setAge } /> );
			});
			render( <TestComp><Child /></TestComp> );
			expect( storeRef.current!.getState().age ).toBe( sourceData.age );
			fireEvent.click( screen.getByRole( 'button' ) );
			expect( storeRef.current!.getState().age ).toBe( NEW_AGE );
			cleanupPerfTest();
		});
		test( 'can update store and propagate observing components', async () => {
			storeRef = undefined as unknown as typeof storeRef;
			const Child =  connect( EagleEyeContext, {
				fName: 'name.first'
			})(({ data: { fName } }) => (
				<>They call me: <span data-testid="fname">{ fName }</span></>
			));
			render( <TestComp><Child /></TestComp> );
			expect( screen.getByTestId( 'fname' ).textContent )
				.toEqual( sourceData.name.first );
			const NEW_FNAME = 'Imagene';
			storeRef.current!.setState({
				name: {
					first: NEW_FNAME
				}
			});
			await wait(() => {
				expect( screen.getByTestId( 'fname' ).textContent )
					.toEqual( NEW_FNAME );
			});
			cleanupPerfTest();
		});
		test( 'can reset store and propagate observing components', async () => {
			storeRef = undefined as unknown as typeof storeRef;
			const NEW_EMAIL = 'some.gobbledygook.co.uk';
			const Child =  connect( EagleEyeContext, {
				myEmail: 'email'
			} )(({ data: { myEmail }, setState }) => {
				const setEmail = React.useCallback(
					() => setState({ email: NEW_EMAIL }),
					[ setState ]
				);
				return (
					<>
						<>Here is my email: <span data-testid="myemail">{ myEmail }</span></>
						<button value="set email" onClick={ setEmail } />
					</>
				);
			});
			render( <TestComp><Child /></TestComp> );
			expect( screen.getByTestId( 'myemail' ).textContent )
				.toEqual( sourceData.email );
			fireEvent.click( screen.getByRole( 'button' ) );
			await await(() => {
				expect( screen.getByTestId( 'myemail' ).textContent )
					.toEqual( NEW_EMAIL );
			});
			storeRef.current!.resetState([ 'email' ]);
			await wait(() => {
				expect( screen.getByTestId( 'myemail' ).textContent )
					.toEqual( sourceData.email );
			});
			cleanupPerfTest();
		});
		test( 'can observe state changes coming into the store', async () => {
			storeRef = undefined as unknown as typeof storeRef;
			const Child =  connect( EagleEyeContext )(({ setState }) => {
				const setCompany : React.MouseEventHandler<HTMLButtonElement> = React.useCallback(
					e => setState({ company: ( e.target as HTMLButtonElement ).value }),
					[ setState ]
				);
				return ( <button value="set company" onClick={ setCompany } /> );
			});
			render( <TestComp><Child /></TestComp> );
			const onChangeMock = jest.fn();
			const unsub = storeRef.current!.subscribe( onChangeMock );
			const NEW_CNAME = 'What is my company name again?????';
			fireEvent.click( screen.getByRole( 'button' ), {
				target: { value: NEW_CNAME }
			});
			expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
			expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({ company: NEW_CNAME });
			expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'company' ]]);
			expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({ company: NEW_CNAME });
			expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
			onChangeMock.mockClear();
			const NEW_CNAME2 = 'Alright! let me tell you what\'s what!!!!!';
			fireEvent.click( screen.getByRole( 'button' ), {
				target: { value: NEW_CNAME2 }
			});
			expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
			expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({ company: NEW_CNAME2 });
			expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'company' ]]);
			expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({ company: NEW_CNAME2 });
			expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
			unsub(); // unsubscribe store change listener
			onChangeMock.mockClear();
			const NEW_CNAME3 = 'Geez! Did you get the name I just gave ya?????';
			fireEvent.click( screen.getByRole( 'button' ), {
				target: { value: NEW_CNAME3 }
			});
			expect( onChangeMock ).not.toHaveBeenCalled();
			cleanupPerfTest();
		});
	} );
	describe( 'prehooks', () => {
		describe( 'resetState prehook', () => {
			describe( 'when `resetState` prehook does not exist on the context', () => {
				test( 'completes `store.resetState` method call', async () => {
					const { renderCount } : PerfValue = perf( React );
					const prehooks = {};
					render( <Product prehooks={ prehooks } type="Computer" /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					let baseRenderCount : Record<string,any> = {};
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.click( screen.getByRole( 'button', { name: 'reset context' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 ); // DULY UPDATED WITH NEW STATE RESET
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 ); // DULY UPDATED WITH NEW STATE RESET
					});
					cleanupPerfTest();
				} );
			} );
			describe( 'when `resetState` prehook exists on the context', () => {
				test( 'is called by the `store.resetState` method', async () => {
					const prehooks = Object.freeze({ resetState: jest.fn().mockReturnValue( false ) });
					render( <Product prehooks={ prehooks } type="Computer" /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					fireEvent.change( screen.getByLabelText( 'New Color:' ), { target: { value: 'Teal' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update color' } ) );
					prehooks.resetState.mockClear();
					fireEvent.click( screen.getByRole( 'button', { name: 'reset context' } ) );
					expect( prehooks.resetState ).toHaveBeenCalledTimes( 1 );
					expect( prehooks.resetState ).toHaveBeenCalledWith({
						[ REPLACE_TAG ]: {
							// data slices from original state to reset current state slices
							color: 'Burgundy',
							customer: {
								name: { first: null, last: null },
								phone: null
							},
							price: 22.5,
							type: 'Computer'
						}
					}, {
						// current: context state value after the `update type` & `update color` button clicks
						current: {
							color: 'Teal',
							customer: {
								name: { first: null, last: null },
								phone: null
							},
							price: 22.5,
							type: 'Bag'
						},
						// original: obtained from the './normal' Product >> Provider value prop
						original: {
							color: 'Burgundy',
							customer: {
								name: { first: null, last: null },
								phone: null
							},
							price: 22.5,
							type: 'Computer'
						}
					});
				} );
				test( 'completes `store.setState` method call if `setState` prehook returns TRUTHY', async () => {
					const { renderCount } : PerfValue = perf( React );
					const prehooks = Object.freeze({ resetState: jest.fn().mockReturnValue( true ) });
					render( <Product prehooks={ prehooks } type="Computer" /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.click( screen.getByRole( 'button', { name: 'reset context' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 ); // DULY UPDATED WITH NEW STATE RESET
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 ); // DULY UPDATED WITH NEW STATE RESET
					});
					cleanupPerfTest();
				} );
				test( 'aborts `store.setState` method call if `setState` prehook returns FALSY', async () => {
					const { renderCount } : PerfValue = perf( React );
					const prehooks = Object.freeze({ resetState: jest.fn().mockReturnValue( false ) });
					render( <Product prehooks={ prehooks } type="Computer" /> );
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.click( screen.getByRole( 'button', { name: 'reset context' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 0 ); // NORMAL UPDATE DUE CANCELED: RESET STATE ABORTED
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.TallyDisplay ).toBe( 0 ); // NORMAL UPDATE DUE CANCELED: RESET STATE ABORTED
					});
					cleanupPerfTest();
				} );
			} );
		} );
		describe( 'setState prehook', () => {
			describe( 'when `setState` prehook does not exist on the context', () => {
				test( 'completes `store.setState` method call', async () => {
					const { renderCount } : PerfValue = perf( React );
					const prehooks = Object.freeze( expect.any( Object ) );
					render( <Product prehooks={ prehooks } type="Computer" /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 ); // DULY UPDATED WITH NEW STATE CHANGE
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 ); // DULY UPDATED WITH NEW STATE CHANGE
					});
					cleanupPerfTest();
				} );
			} );
			describe( 'when `setState` prehook exists on the context', () => {
				test( 'is called by the `store.setState` method', async () => {
					const prehooks = Object.freeze({ setState: jest.fn().mockReturnValue( false ) });
					render( <Product prehooks={ prehooks } type="Computer" /> );
					prehooks.setState.mockClear();
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					expect( prehooks.setState ).toHaveBeenCalledTimes( 1 );
					expect( prehooks.setState ).toHaveBeenCalledWith({ type: 'Bag' });
				} );
				test( 'completes `store.setState` method call if `setState` prehook returns TRUTHY', async () => {
					const { renderCount } : PerfValue = perf( React );
					const prehooks = Object.freeze({ setState: jest.fn().mockReturnValue( true ) });
					render( <Product prehooks={ prehooks } type="Computer" /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 1 ); // DULY UPDATED WITH NEW STATE CHANGE
						expect( netCount.Reset ).toBe( 1 ); // UPDATED BY REACT PROPAGATION (b/c no memoization)
						expect( netCount.TallyDisplay ).toBe( 1 ); // DULY UPDATED WITH NEW STATE CHANGE
					});
					cleanupPerfTest();
				} );
				test( 'aborts `store.setState` method call if `setState` prehook returns FALSY', async () => {
					const { renderCount } : PerfValue = perf( React );
					const prehooks = Object.freeze({ setState: jest.fn().mockReturnValue( false ) });
					render( <Product prehooks={ prehooks } type="Computer" /> );
					let baseRenderCount : Record<string,any>;
					await wait(() => { baseRenderCount = transformRenderCount( renderCount ) });
					fireEvent.change( screen.getByLabelText( 'New Type:' ), { target: { value: 'Bag' } } );
					fireEvent.click( screen.getByRole( 'button', { name: 'update type' } ) );
					await wait(() => {
						const netCount = transformRenderCount( renderCount, baseRenderCount ) as any;
						expect( netCount.CustomerPhoneDisplay ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.Editor ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.PriceSticker ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.ProductDescription ).toBe( 0 ); // NORMAL UPDATE DUE CANCELED: SET STATE ABORTED
						expect( netCount.Reset ).toBe( 0 ); // unaffected: no use for product type data
						expect( netCount.TallyDisplay ).toBe( 0 ); // NORMAL UPDATE DUE CANCELED: SET STATE ABORTED
					});
					cleanupPerfTest();
				} );
			} );
		} );
	} );
	describe( 'API', () => {
		describe( 'connect(...)', () => {
			let state : {items: Array<{name: string}>};
			let EagleEyeContext : EagleEyeContextClass<typeof state>;
			let selectorMap : { all : string; box : string; };
			let connector : Function;
			let ConnectedComponent1 : ConnectedComponent<ExtractInjectedProps<typeof state, typeof selectorMap>>;
			let ConnectedComponent2 : ConnectedComponent<ExtractInjectedProps<typeof state, typeof selectorMap>>;
			let ConnectedRefForwardingComponent : React.ForwardRefExoticComponent<React.RefAttributes<unknown>>;
			let ConnectedMemoizedComponent : ConnectedComponent<ExtractInjectedProps<typeof state, typeof selectorMap>>;
			let compOneProps : { data : typeof selectorMap };
			let compTwoProps : { data : typeof selectorMap };
			let refForwardingCompProps : { data: typeof selectorMap };
			let memoCompProps : { data: typeof selectorMap };
			beforeAll(() => {
				state = {
					items: [
						{ name: 'box_0' },
						{ name: 'box_1' },
						{ name: 'box_2' },
						{ name: 'box_3' }
					]
				};
				EagleEyeContext = createEagleEye<typeof state>();
				selectorMap = {
					all: FULL_STATE_SELECTOR,
					box: 'items.1.name'
				};
				connector = connect( EagleEyeContext, selectorMap );
				let rawComp : React.FC<typeof compOneProps> = props => { compOneProps = props; return null };
				ConnectedComponent1 = connector( rawComp );
				rawComp = props => { compTwoProps = props; return null };
				ConnectedComponent2 = connector( rawComp );
				let rawRefComp : React.ForwardRefRenderFunction<unknown, typeof compOneProps> = props => {
					refForwardingCompProps = props;
					return null;
				};
				const RefForwardingComponent = React.forwardRef( rawRefComp );
				RefForwardingComponent.displayName = 'Connect.RefForwardingComponent';
				ConnectedRefForwardingComponent = connector( RefForwardingComponent );
				rawComp = props => { memoCompProps = props; return null };
				const MemoizedComponent = React.memo( rawComp );
				MemoizedComponent.displayName = 'Connect.MemoizedComponent';
				ConnectedMemoizedComponent = connector( MemoizedComponent );
			});
			test( 'returns a function', () => expect( connector ).toBeInstanceOf( Function ) );
			describe( "returned function's return value", () => {
				beforeAll(() => {
					const Ui = () => (
						<article>
							<header>Just a Nested Content Tester</header>
							<main>
								<ConnectedComponent1 />
								<ConnectedComponent2 />
								<ConnectedRefForwardingComponent />
								<ConnectedMemoizedComponent />
							</main>
							<footer>The End</footer>
						</article>
					);
					render(
						<EagleEyeContext.Provider value={ state }>
							<Ui />
						</EagleEyeContext.Provider>
					);
				});
				test( 'is always a memoized component', () => {
					expect( 'compare' in ConnectedComponent1 ).toBe( true );
					expect( 'compare' in ConnectedComponent2 ).toBe( true );
					expect( 'compare' in ConnectedRefForwardingComponent ).toBe( true );
					expect( 'compare' in ConnectedMemoizedComponent ).toBe( true );
				} );
				test( 'is always interested in the same context state data', () => {
					expect( compOneProps.data ).toStrictEqual( compTwoProps.data );
					expect( compOneProps.data ).toStrictEqual( refForwardingCompProps.data );
					expect( compOneProps.data ).toStrictEqual( memoCompProps.data );
				} );
				test( "contains the store's public API", () => {
					const data : Record<string, unknown> = {};
					for( const k in selectorMap ) { data[ k ] = expect.anything() }
					expect( compOneProps ).toEqual({
						data,
						resetState: expect.any( Function ),
						setState: expect.any( Function )
					});
				} );
				test( 'accepts own props (i.e. additional props at runtime)', () => {
					let capturedProps;
					const selectorMap = {
						fullBox2: 'items[1]',
						nameFirstBox: 'items.0.name'
					};
					const ownProps = {
						anotherOwnProp: expect.anything(),
						ownProp: expect.anything()
					};
					const WrappedComponent : React.ComponentType<ConnectProps<
						typeof ownProps,
						typeof state,
						typeof selectorMap
					>> = props => {
						capturedProps = props;
						return ( <div /> );
					};
					const ConnectedComponent = connect( EagleEyeContext, selectorMap )( WrappedComponent );
					const App = () => (
						<EagleEyeContext.Provider value={ state }>
							<ConnectedComponent { ...ownProps } ref={ React.useRef() } />
						</EagleEyeContext.Provider>
					);
					render( <App /> );
					const data : Record<string, unknown>  = {};
					for( const k in selectorMap ) { data[ k ] = expect.anything() }
					expect( capturedProps ).toEqual({
						...ownProps,
						data,
						resetState: expect.any( Function ),
						setState: expect.any( Function )
					});
				} );
				describe( 'prop name conflict resolution: ownProps vs store API props', () => {
					test( 'defaults to ownProps', () => {
						const ownProps = {
							data: {
								anotherOwnProp: expect.anything(),
								ownProp: expect.anything()
							}
						};
						let capturedProps : Record<string,unknown> = {};
						const selectorMap = {
							fullBox2: 'items[1]',
							nameFirstBox: 'items.0.name'
						};
						const T : React.FC<typeof capturedProps> = props => {
							capturedProps = props;
							return null
						};
						const fn = connect( EagleEyeContext, selectorMap );
						const ConnectedComponent = connect( EagleEyeContext, selectorMap )( T );
						render(
							<EagleEyeContext.Provider value={ state }>
								<ConnectedComponent { ...ownProps } />
							</EagleEyeContext.Provider>
						);
						const data : Record<string,unknown> = {};
						for( const k in selectorMap ) { data[ k ] = expect.anything() }
						expect( capturedProps ).toEqual({
							...ownProps, // using `data` from ownProps
							resetState: expect.any( Function ),
							setState: expect.any( Function )
						});
					} );
				} );
			} );
		} );
	} );
	describe( 'util', () => {
		describe( 'mkReadonly(...)', () => {
			function getTestData() {
				return {
					a: {
						b: {
							c: 33,
							d: new Date()
						},
						items: [ 1, 3, 5 ],
						j: 'this is my test message'
					},
					items: [ , {}, 'just me', null ],
					r: new RegExp( /g/ ),
					x: true,
					y: { z: new class{} },
					z: new class{}
				};
			}
			test( 'converts all to readonly', () => {
				const data = getTestData();
				expect( isReadonly( data ) ).toBe( false );
				mkReadonly( data );
				expect( isReadonly( data ) ).toBe( true );
			} );
			test( 'also returns the object reference', () => {
				expect( isReadonly( mkReadonly( getTestData() )) ).toBe( true );
			} );
		} );
	})
} );
