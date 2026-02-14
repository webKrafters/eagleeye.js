import { AccessorResponse, Immutable } from '@webkrafters/auto-immutable';

import {
	ShutdownReason,
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
	ACCESS_SYM,
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

function getMockStorage<T extends State>( data : Partial<T> ) {
	return {
		clone: jest.fn().mockReturnValue( clonedeep( data ) ),
		getItem: jest.fn().mockReturnValue( data ),
		removeItem: jest.fn().mockImplementation( k => {
			data = null as unknown as typeof data;
		}),
		setItem: jest.fn().mockImplementation(( k, v ) => { data = v })
	} as IStorage<T>
}

describe( 'EagleEyeContext', () => {
	let data : SourceData;
	let immutable : Immutable<SourceData>;
	beforeAll(() => {
		data = createSourceData();
		immutable = new AutoImmutable( data );
	});
	describe( 'creation: all parameters are optional', () => {
		let storage : IStorage<SourceData>;
		beforeEach(() => { storage = getMockStorage( null as unknown as Partial<SourceData> ) });
		afterEach(() => { storage = null as unknown as typeof storage })
		test( 'can be instantiated when state data is not yet available', () => {
			expect( new EagleEyeContextClass() ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( undefined, {}, storage ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( undefined, undefined, storage ) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be instantiated with a known default state data', () => {
			expect( new EagleEyeContextClass<SourceData>( data, {}, storage ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( data, {} ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( data, undefined, storage ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( data ) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be instantiated with an existing immutable state data', () => {
			expect( new EagleEyeContextClass<SourceData>( immutable, {}, storage ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( immutable, {} ) ).toBeInstanceOf( EagleEyeContextClass );
			expect( new EagleEyeContextClass<SourceData>( immutable, undefined, storage ) ).toBeInstanceOf( EagleEyeContextClass );
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
				storage,
				value: data
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				prehooks: {},
				storage,
				value: data
			}) ).toBeInstanceOf( EagleEyeContextClass );
		} );
		test( 'can be obtained through the create function using an existing immutable state data', () => {
			expect( createEagleEye({
				value: immutable
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				storage,
				value: immutable
			}) ).toBeInstanceOf( EagleEyeContextClass );
			expect( createEagleEye({
				prehooks: {},
				storage,
				value: immutable
			}) ).toBeInstanceOf( EagleEyeContextClass );
		} );
	} );
	describe( 'EagleEyeContext.createStoreRef(...)', () => {
		let context : EagleEyeContextClass;
		beforeAll(() => { context = new EagleEyeContextClass() });
		afterAll(() => { context.dispose() });
		test( 'throws exception by default', () => {
			expect(() => context.createStoreRef()).toThrow(
				'May not create store reference out of context. Plese use `this.store` to obtain externally available store reference.'	
			);
		} );
		test( 'requires the proper access token to create dedicated store referneces', () => {
			expect(() => context.createStoreRef( Symbol( ACCESS_SYM.description ) )).toThrow(
				'May not create store reference out of context. Plese use `this.store` to obtain externally available store reference.'	
			);
			expect(() => context.createStoreRef( Symbol( ACCESS_SYM.toString() ) )).toThrow(
				'May not create store reference out of context. Plese use `this.store` to obtain externally available store reference.'	
			);
			const newStoreRef = context.createStoreRef( ACCESS_SYM );
			expect( newStoreRef ).not.toBe( context.store );
			expect( context.store ).toEqual({
    			close: expect.any( Function ),
    			closed: expect.any( Boolean ),
				resetState: expect.any( Function ),
				setState: expect.any( Function ),
				getState: expect.any( Function ),
				subscribe: expect.any( Function )
			})
			expect( newStoreRef ).toEqual({
    			close: expect.any( Function ),
    			closed: expect.any( Boolean ),
				resetState: expect.any( Function ),
				setState: expect.any( Function ),
				getState: expect.any( Function ),
				subscribe: expect.any( Function )
			});
		} );
	} );
	describe( 'EagleEyeContext.dispose(...)', () => {
		test( 'releases references held by an active context', () => {
			const context = new EagleEyeContextClass();
			expect( context.closed ).toBe( false );
			expect( context.cache ).toBeInstanceOf( Immutable );
			context.dispose();
			expect( context.closed ).toBe( true );
			expect( context.cache ).toBeNull();
		} );
		test( 'makes the context non-responsive', () => {
			const context = new EagleEyeContextClass();
			expect( context.store.getState() ).toEqual({});
			context.dispose();
			expect( context.store.getState() ).toBeUndefined();
		} );
	});
	describe( 'properties', () => {
		let storage : IStorage<SourceData>;
		let sourceData : SourceData;
		let context : EagleEyeContextClass<SourceData>;
		let prehooks : Prehooks<SourceData>;
		beforeAll(() => {
			storage = getMockStorage( null as unknown as Partial<SourceData> );
			prehooks = {};
			sourceData = createSourceData();
			context = new EagleEyeContextClass( sourceData, prehooks, storage );
		});
		describe( 'EagleEyeContext.cache', () => {
			test( 'can be retrieved', () => {
				expect( context.cache ).toBeInstanceOf( Immutable );
			} );
		} );
		describe( 'EagleEyeContext.closed', () => {
			test( 'flag indicating a non-responsive context', () => {
				let ctx = new EagleEyeContextClass();
				expect( ctx.closed ).toBe( false );
				ctx.store.setState({ a: 44 });
				expect( ctx.store.getState() ).toEqual({ a: 44 });
				ctx.dispose();
				expect( ctx.closed ).toBe( true );
				// lost connection to the underlying cache
				ctx.store.setState({ c: 66 });
				expect( ctx.store.getState() ).toBeUndefined();

				const cache = new AutoImmutable({});
				let connection = cache.connect();
						
				ctx = new EagleEyeContextClass( cache );
				expect( ctx.closed ).toBe( false );
				ctx.store.setState({ a: 44 });
				let state = connection.get();
				expect( state ).toEqual({
					[ AutoImmutableModule.GLOBAL_SELECTOR ] :{
						a: 44
					}
				});
				
				ctx.dispose();
				expect( cache.closed ).toBe( false );
				expect( ctx.closed ).toBe( true );
				expect( ctx.store.closed ).toBe( true );

				// lost connection to the underlying cache
				ctx.store.setState({ c: 66 });
				expect( ctx.store.getState() ).toBeUndefined();
				expect( state[ AutoImmutableModule.GLOBAL_SELECTOR ] ).toBe(
					connection.get()[ AutoImmutableModule.GLOBAL_SELECTOR ]
				);

				// create new context to consume same cache
				ctx = new EagleEyeContextClass( cache );
				ctx.store.setState({ c: 66 });
				state = connection.get();
				expect( state ).toEqual({
					[ AutoImmutableModule.GLOBAL_SELECTOR ] :{
						a: 44,
						c: 66
					}
				});

				cache.close(); // cache closing automatically closes the context
				expect( cache.closed ).toBe( true );
				expect( ctx.closed ).toBe( true );
				expect( ctx.store.closed ).toBe( true );

				// lost connection to the underlying cache
				ctx.store.setState({ c: 66 });
				expect( connection.get() ).toBeUndefined();
				expect( ctx.store.getState() ).toBeUndefined();
			} );
		} );
		describe( 'EagleEyeContext.prehooks', () => {
			let connectSetSpy : jest.SpyInstance<void, [
				changes: AutoImmutableModule.Changes<{}>,
				onComplete?: AutoImmutableModule.Listener | undefined
			], any>;
			let AutoImmutableSpy : jest.SpyInstance<AutoImmutableModule.Connection<any>, [], any>
			beforeAll(() => {
				const cache = new AutoImmutable({});
				const connection = cache.connect();
				connectSetSpy = jest.spyOn( connection, 'set' );
				AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
				AutoImmutableSpy.mockReturnValue( connection );

			});
			afterAll(() => {
				connectSetSpy.mockRestore();
				AutoImmutableSpy.mockRestore();
			})
			beforeEach(() => {
				connectSetSpy.mockClear();
				AutoImmutableSpy.mockClear();
			});
			test( 'can be set and retrieved', () => {
				expect( context.prehooks ).toBe( prehooks );
				const newPrehooks =  {};
				context.prehooks = newPrehooks;
				expect( context.prehooks ).not.toBe( prehooks );
				expect( context.prehooks ).toBe( newPrehooks );
			} );
			describe( 'resetState prehook', () => {
				describe( 'when `resetState` prehook does not exist on the context', () => {
					test( 'completes `store.resetState` method call', () => {
						const ctx = new EagleEyeContextClass();
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });
						ctx.store.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({});

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });
						liveStore.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({});

						liveStore.endStream();

						ctx.dispose();
					} );
				} );
				describe( 'when `resetState` prehook exists on the context', () => {
					test( 'is called by the `store.resetState` method', () => {
						const prehooks = Object.freeze({
							resetState: jest.fn().mockReturnValue( false )
						});
						const ctx = new EagleEyeContextClass( undefined, prehooks );
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						ctx.store.resetState([ FULL_STATE_SELECTOR ]);
						expect( prehooks.resetState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.resetState ).toHaveBeenCalledWith(
							{ [ REPLACE_TAG ]: {} },
							{
								current: { any: 'thing' },
								original: {}
							}
						);
						prehooks.resetState.mockClear();

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ any: 'thing' });
						liveStore.resetState([ FULL_STATE_SELECTOR ]);
						expect( prehooks.resetState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.resetState ).toHaveBeenCalledWith(
							{ [ REPLACE_TAG ]: {} },
							{
								current: { any: 'thing' },
								original: {}
							}
						);

						liveStore.endStream();

						ctx.dispose();
					} );
					test( 'completes `store.resetState` method call if `resetState` prehook returns TRUTHY', () => {
						const ctx = new EagleEyeContextClass( undefined, {
							resetState: jest.fn().mockReturnValue( true )
						} );
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						ctx.store.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({});

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						liveStore.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({});

						liveStore.endStream();

						ctx.dispose();
					} );
					test( 'aborts `store.resetState` method call if `resetState` prehook returns FALSY', () => {
						const ctx = new EagleEyeContextClass( undefined, {
							resetState: jest.fn().mockReturnValue( false )
						} );
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						ctx.store.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).not.toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({
							any: 'thing'
						});

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ from: 'stream' });
						connectSetSpy.mockClear();
						liveStore.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).not.toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({
							any: 'thing', from: 'stream'
						});

						liveStore.endStream();

						ctx.dispose();
					} );
				} );
			} );
			describe( 'setState prehook', () => {
				describe( 'when `setState` prehook does not exist on the context', () => {
					test( 'completes `store.setState` method call', () => {
						const ctx = new EagleEyeContextClass();
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ from: 'stream' });
						expect( ctx.store.getState() ).toEqual({
							any: 'thing', from: 'stream'
						});

						liveStore.endStream();

						ctx.dispose();
					} );
				} );
				describe( 'when `setState` prehook exists on the context', () => {
					test( 'is called by the `store.setState` method', () => {
						const prehooks = Object.freeze({
							setState: jest.fn().mockReturnValue( false )
						});
						const ctx = new EagleEyeContextClass( undefined, prehooks );
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( prehooks.setState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.setState ).toHaveBeenCalledWith({ any: 'thing' });
						prehooks.setState.mockClear();

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ from: 'stream' });
						expect( prehooks.setState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.setState ).toHaveBeenCalledWith({ from: 'stream' });

						liveStore.endStream();

						ctx.dispose();
					} );
					test( 'completes `store.setState` method call if `setState` prehook returns TRUTHY', () => {
						const ctx = new EagleEyeContextClass( undefined, {
							setState: jest.fn().mockReturnValue( true )
						});
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ from: 'stream' });
						expect( connectSetSpy ).toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({
							any: 'thing', from: 'stream'
						});

						liveStore.endStream();

						ctx.dispose();
					} );
					test( 'aborts `store.setState` method call if `setState` prehook returns FALSY', () => {
						const ctx = new EagleEyeContextClass( undefined, {
							setState: jest.fn().mockReturnValue( false )
						} );
						expect( connectSetSpy ).not.toHaveBeenCalled();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( connectSetSpy ).not.toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({});

						// also applies to stream generated updates
						const liveStore = ctx.stream();
						liveStore.setState({ from: 'stream' });
						expect( connectSetSpy ).not.toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({});

						liveStore.endStream();

						ctx.dispose();
					} );
				} );
			} );
		} );
		describe( 'EagleEyeContext.storage', () => {
			test( 'can be set and retrieved', () => {
				const currentStorage = context.storage;
				expect( currentStorage ).toBe( storage );
				const newStorage : Storage = {
					...storage, _data: undefined as unknown as SourceData
				}
				context.storage = newStorage;
				expect( context.storage ).not.toBe( currentStorage );
				expect( context.storage ).toBe( newStorage );
			} );
			test( 'change transfers value from old storage to the new', () => {
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
		} );
		describe( 'EagleEyeContext.store', () => {
			test( 'provides external store reference', () => {
				expect( context.store ).toStrictEqual( expect.objectContaining({
					getState: expect.any( Function ),
					resetState: expect.any( Function ),
					setState: expect.any( Function ),
					subscribe: expect.any( Function ),
				}) );
			} );
			test( 'in isolation, maintains communication with the context', () => {
				const ctx = new EagleEyeContextClass({});
				const store = ctx.store;
				const mockCloseListener = jest.fn();
				store.subscribe( 'closing', mockCloseListener );
				ctx.dispose();
				expect( mockCloseListener ).toHaveBeenCalled();
				store.close();
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
								ctx.store.getState( pPaths ),
								ctx.store.getState( pPaths )
							) ).toBe( true );
						} );
					} );
					describe( 'guarantees data immutability by...', () => {
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
				test( 'updates are propagated to all streaming components', () => {
					const ctx = new EagleEyeContextClass( createSourceData() );
					const liveStore1 = ctx.stream({
						b: 'balance',
						f: 'name.first',
						g: 'gender'
					});
					const liveStore2 = ctx.stream([
						'phone.country',
						'phone.area',
						'phone.local',
						'phone.line'
					]);
					expect( liveStore1.data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( liveStore2.data ).toEqual({
						0: '+1',
						1: '947',
						2: '552',
						3: '2282'
					});
					ctx.store.setState({
						name: {
							first: 'Imagene'
						} as SourceData["name"],
						phone: {
							area: '212',
							line: '5000',
							local: '555'
						} as SourceData["phone"],
					});
					expect( liveStore1.data ).toEqual({
						b: '$3,311.66',
						f: 'Imagene',
						g: 'female'
					});
					expect( liveStore2.data ).toEqual({
						0: '+1',
						1: '212',
						2: '555',
						3: '5000'
					});
					liveStore1.endStream();
					liveStore2.endStream();
					ctx.dispose();
				} );
				test( 'can reset state and propagate to all streaming components', () => {
					const ctx = new EagleEyeContextClass( createSourceData() );
					const liveStore1 = ctx.stream({
						b: 'balance',
						f: 'name.first',
						g: 'gender'
					});
					const liveStore2 = ctx.stream([
						'phone.country',
						'phone.area',
						'phone.local',
						'phone.line'
					]);
					ctx.store.setState({
						name: {
							first: 'Imagene'
						} as SourceData["name"],
						phone: {
							area: '212',
							line: '5000',
							local: '555'
						} as SourceData["phone"],
					});
					expect( liveStore1.data ).toEqual({
						b: '$3,311.66',
						f: 'Imagene',
						g: 'female'
					});
					expect( liveStore2.data ).toEqual({
						0: '+1',
						1: '212',
						2: '555',
						3: '5000'
					});
					ctx.store.resetState([ FULL_STATE_SELECTOR ]);
					expect( liveStore1.data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( liveStore2.data ).toEqual({
						0: '+1',
						1: '947',
						2: '552',
						3: '2282'
					});
					liveStore1.endStream();
					liveStore2.endStream();
					ctx.dispose();
				});
				test( 'subscribes to context exit', () => {
					/** context disposal initiates closing process */
					let ctx = new EagleEyeContextClass();
					const onClosingMock = jest.fn();
					ctx.store.subscribe( 'closing', onClosingMock );
					expect( onClosingMock ).not.toHaveBeenCalled();
					expect( ctx.closed ).toBe( false );
					ctx.dispose();
					expect( onClosingMock ).toHaveBeenCalled();
					expect( ctx.closed ).toBe( true );
					onClosingMock.mockClear();
					
					/** loss of underlying cache will initiate closing process */
					const cache = new AutoImmutable({});
					ctx = new EagleEyeContextClass( cache );
					ctx.store.subscribe( 'closing', onClosingMock );
					expect( onClosingMock ).not.toHaveBeenCalled();
					expect( ctx.closed ).toBe( false );
					cache.close();
					expect( onClosingMock ).toHaveBeenCalled();
					expect( ctx.closed ).toBe( true );
				} );
				test( 'subscribes to state changes', () => {
					const changes = { price: 45 };
					const onChangeMock = jest.fn();
					const unsub = ctx.store.subscribe( 'data-updated', onChangeMock );
					expect( onChangeMock ).not.toHaveBeenCalled();
					ctx.store.setState( changes );
					expect( onChangeMock ).toHaveBeenCalled();
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual( changes );
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'price' ]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual( changes );
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					const changes2 = [{
						color: 'Navy',
						type: 'TEST TYPE_2'
					}, {
						customer: {
							name: {
								last: 'T_last_2'
							}
						}
					}];
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
				test( 'observes all state changes coming into the context', async () => {
					const ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
					const onChangeMock = jest.fn()
					const unsub = ctx.store.subscribe( 'data-updated', onChangeMock );
					
					const NEW_CNAME = 'What is my company name again?????';
					const liveStore = ctx.stream();
					liveStore.setState({ company: NEW_CNAME });
					expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({ company: NEW_CNAME });
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'company' ]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({ company: NEW_CNAME });
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					
					const NEW_CNAME2 = 'Alright! let me tell you what\'s what!!!!!';
					const liveStore2 = ctx.stream();
					liveStore2.setState({ company: NEW_CNAME2 });
					expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({ company: NEW_CNAME2 });
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'company' ]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({ company: NEW_CNAME2 });
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					
					liveStore.resetState([ FULL_STATE_SELECTOR ]);
					expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({[ REPLACE_TAG ]: sourceData });
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual( sourceData );
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					
					unsub(); // unsubscribe store change listener
					liveStore2.setState({
						company: 'Geez! Did you get the name I sent ya?????'
					});
					expect( onChangeMock ).not.toHaveBeenCalled();

					liveStore.endStream();
					liveStore2.endStream();

					ctx.dispose();
				} );
			} );
		} );
		describe( 'EagleEyeContext.stream', () => {
			test( 'provides change stream', () => {
				expect( context.stream ).toEqual( expect.any( Function ) );
			} );
			test( "invocation returns an observable LiveStore 'an automatically updating store'", () => {
				expect( context.stream() ).toBeInstanceOf( LiveStore );
			} );
			test( 'in isolation, maintains communication with the context', () => {
				const ctx = new EagleEyeContextClass({});
				expect( ctx.store.getState() ).toEqual({});
				ctx.store.setState({ b: 22 });
				const useStream = ctx.stream;
				const liveStore_0 = useStream({
					anchor: 'a'
				});
				const liveStore_1 = useStream({
					myRes : 'b',
					testVal: 'a'
				});
				expect( ctx.store.getState() ).toEqual({
					b: 22
				});
				expect( liveStore_0.data ).toEqual({
					anchor: undefined
				});
				expect( liveStore_1.data ).toEqual({
					myRes : 22,
					testVal: undefined
				});
				ctx.store.setState({ a: 1024 });
				expect( ctx.store.getState() ).toEqual({
					a: 1024,
					b: 22
				});
				expect( liveStore_0.data ).toEqual({
					anchor: 1024
				});
				expect( liveStore_1.data ).toEqual({
					myRes : 22,
					testVal: 1024
				});
				
				liveStore_0.endStream();
				liveStore_1.endStream();

				ctx.dispose();
			} );
			describe( "change stream's LiveStore", () => {
				let data : Partial<SourceData>;
				let ctx0 : EagleEyeContextClass<Partial<SourceData>>;
				const selectorMapOnRender = {
					year3: 'history.places[2].year',
					isActive: 'isActive',
					tag6: 'tags[5]'
				};
				beforeAll(() => {
					data = createSourceData();
					ctx0 = createEagleEye({ value: data });
				});
				afterAll(() => { ctx0.dispose() });
				test( 'returns a store with labeled state slices', () => {
					const store = ctx0.stream({
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
					store.endStream();
				} );
				describe( 'events', () => {
					describe( 'stream-ending', () => {
						let ctx : EagleEyeContextClass<Partial<SourceData>>;
						beforeEach(() => {
							ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
						});
						afterEach(() =>  { ctx.dispose() });
						test( 'invoked at the end of live store streaming phase', () => {
							const store = ctx.stream();
							const closeHandler = jest.fn();
							store.addListener( 'stream-ending', closeHandler );
							expect( closeHandler ).not.toHaveBeenCalled();
							store.endStream();
							expect( closeHandler ).toHaveBeenCalled();
						} );
						test( 'invoked with a user level message at normal closure', () => {
							const store = ctx.stream();
							const closeHandler = jest.fn();
							store.addListener( 'stream-ending', closeHandler );
							store.endStream();
							expect( closeHandler ).toHaveBeenCalledWith( ShutdownReason.LOCAL );
						} );
						test( 'is invoked with a cache level message when closing due to downstream cache closure', () => {
							const cache = new AutoImmutable( createSourceData() );
							const ctx = new EagleEyeContextClass( cache );
							const store = ctx.stream();
							const closeHandler = jest.fn();
							store.addListener( 'stream-ending', closeHandler );
							expect( store.streaming ).toBe( true );
							ctx.cache.close();
							expect( store.streaming ).toBe( false );
							expect( closeHandler ).toHaveBeenCalledWith( ShutdownReason.CACHE );
							ctx.dispose();
						} );
						test( 'is invoked with a context level message when closing due to context disposal', () => {
							const cache = new AutoImmutable( createSourceData() );
							const ctx = new EagleEyeContextClass( cache );
							const store = ctx.stream();
							const closeHandler = jest.fn();
							store.addListener( 'stream-ending', closeHandler );
							expect( store.streaming ).toBe( true );
							ctx.dispose();
							expect( store.streaming ).toBe( false );
							expect( closeHandler ).toHaveBeenCalledWith( ShutdownReason.CONTEXT );
						} );
					} );
					describe( 'data-changed', () => {
						let ctx : EagleEyeContextClass<Partial<SourceData>>;
						beforeEach(() => {
							ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
						});
						afterEach(() =>  { ctx.dispose() });
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
							store.addListener( 'data-changed', changeHandler );
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
							store.endStream();
						} );
					} );
				} );
				describe( 'properties', () => {
					describe( 'LiveStore.data', () => {
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
							store.endStream();
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
							store.endStream();
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
							store.endStream();
						} );
						test( 'does not update for resubmitted changes', async () => {
							const ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
							const store = ctx.stream({ company: 'company', fn: 'name.first' });
							expect( store.data ).toEqual({
								company: 'VORTEXACO',
								fn: 'Amber'
							});
							store.setState({
								company: 'New Company',
								name: {
									first: 'Jack'
								} as SourceData[ "name" ]
							} );
							const currStoreData = store.data;
							expect( store.data ).toEqual({
								company: 'New Company',
								fn: 'Jack'
							});
							store.setState({
								company: 'New Company',
								gender: 'Male',
								name: {
									first: 'Jack',
									last: 'Franken'
								}
							} );
							expect( store.data ).toBe( currStoreData );
						} );
						test( 'does not respond to changes not affecting it', async () => {
							const ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
							const store = ctx.stream({ company: 'company', fn: 'name.first' });
							expect( store.data ).toEqual({
								company: 'VORTEXACO',
								fn: 'Amber'
							});
							const currStoreData = store.data;
							store.setState({
								gender: 'Male',
								name: {
									last: 'Franken'
								} as SourceData["name"]
							} );
							expect( store.data ).toBe( currStoreData );
						} );
					} );
					describe( 'LiveStore.selectorMap', () => {
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
								const store = ctx0.stream( origSelectorMap );
								store.selectorMap = _selectorMapOnRender as unknown as OrigSelectorMap;
								expect( Object.keys( store.data ) )
									.toEqual( Object.keys( _selectorMapOnRender ));
								store.selectorMap = selectorMapOnRerender as unknown as OrigSelectorMap;
								expect( Object.keys( store.data ) )
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

								const store = ctx0.stream( selectorMapOnRender );

								expect( connectSpy ).toHaveBeenCalledTimes( 3 );
								expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
								expect( disconnectSpy ).not.toHaveBeenCalled();
								expect( mockUnsubscribe ).not.toHaveBeenCalled();

								store.selectorMap = selectorMapOnRerender as unknown as typeof selectorMapOnRender;
								
								expect( connectSpy ).toHaveBeenCalledTimes( 4 );
								expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
								expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );
								expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

								disconnectSpy.mockRestore();
								getSpy.mockRestore();
								connectSpy.mockRestore();
								cacheSpy.mockRestore();

								store.endStream();
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

									const store = ctx0.stream( selectorMapOnRender );

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

									getSpy.mockRestore();
									connectSpy.mockRestore();
									cacheSpy.mockRestore();

									store.endStream();
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
									class TestEagleEyeContextClass extends EagleEyeContextClass<SourceData> {
										protected _stream : BaseStream<SourceData> = selectorMap => new TestLiveStore( this, selectorMap );
									}

									const ctx = new TestEagleEyeContextClass( sourceData );

									const store = ctx.stream( selectorMapOnRender );

									expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									store.selectorMap = selectorMapOnRerender;

									expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
									expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

									store.endStream();
									
									ctx.dispose();
								});
							});
						} );
						describe( 'accepting an array of propertyPaths in place of a selector map', () => {
							test( 'produces an indexed-based context state data object', () => {
								const store = ctx0.stream([
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
									const store = ctx0.stream( selectorMapOnRender );
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

									store.endStream();

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

									store.endStream();

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
										protected _stream : TestBaseStream = selectorMap => new TestLiveStore( this, selectorMap );
									}

									const ctx = new TestEagleEyeContextClass( sourceData );

									const store = ctx.stream( selectorMapOnRender );

									expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
									expect( mockUnsubscribe ).not.toHaveBeenCalled();
									mockSubscribe.mockClear();

									store.selectorMap = undefined as unknown as typeof selectorMapOnRender;

									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

									store.endStream();

									ctx.dispose();
								} );
							} );
							describe( 'and existing data is empty', () => {
								test( 'leaves the store as-is on selctorMap change', () => {
									let _origData : typeof mockGetReturnValue = {};
									const store = ctx0.stream();
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
									store.endStream();
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

									store.endStream();

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
										protected _stream : TestBaseStream = selectorMap => new TestLiveStore( this, selectorMap );
									}

									const ctx = new TestEagleEyeContextClass( sourceData );

									const store = ctx.stream();

									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									store.selectorMap = {};

									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									store.endStream();

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
											protected _stream : TestBaseStream = selectorMap => new TestLiveStore( this, selectorMap );
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

										store.endStream();

										ctx.dispose();
									} );
								} );
							} );
						} );
					} );
					describe( 'LiveStore.streaming', () => {
						test( 'is flag set for a live store versus a closed store', () => {
							const store = ctx0.stream();
							expect( store.streaming ).toBe( true );
							store.endStream();
							expect( store.streaming ).toBe( false );
						} );
					} );
				} );
				describe( 'LiveStore.addListener', () => {
					let ctx : EagleEyeContextClass<Partial<SourceData>>;
					beforeEach(() => {
						ctx = new EagleEyeContextClass<Partial<SourceData>>( createSourceData() );
					});
					afterEach(() =>  { ctx.dispose() });
					test( 'allows for listeners to be added for store data change and store closing events', () => {
						const store = ctx.stream();
						const mockChangeListener = jest.fn();
						const mockCloseListener = jest.fn();
						store.addListener( 'data-changed', mockChangeListener );
						store.addListener( 'stream-ending', mockCloseListener );
						store.setState({ age: 55 });
						expect( mockChangeListener ).toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						mockChangeListener.mockClear();
						store.setState({ name: { first: 'Janet' } });
						expect( mockChangeListener ).toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						mockChangeListener.mockClear();
						store.endStream();
						expect( mockChangeListener ).not.toHaveBeenCalled();
						expect( mockCloseListener ).toHaveBeenCalled();
					} );
					test( 'attempt to add listeners for unknown events is not allowed', () => {
						const store = ctx.stream();
						expect(() => {
							// @ts-expect-error
							store.addListener( 'someEvent', () => {} );
						} ).toThrow();
						store.endStream();
					} )
				} );
				describe( 'LiveStore.endStream', () => {
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
						store.addListener( 'data-changed', dataChangeHandler );
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
						expect( store.data ).toEqual({ regHour: 22 });
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
						expect( store.data ).toEqual({ regHour: 22 }); // instead of 16
						
						setSpy.mockRestore();
						getSpy.mockRestore();
						connectSpy.mockRestore();

						store.endStream();

					} );
				} );			
				describe( 'LiveStore.removeListener', () => {
					let ctx : EagleEyeContextClass<Partial<SourceData>>;
					beforeEach(() => {
						ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
					});
					afterEach(() =>  { ctx.dispose() });
					test( 'allows for added listeners to be removed for store data change and store closing events', () => {
						const store = ctx.stream();
						const mockChangeListener = jest.fn();
						const mockCloseListener = jest.fn();
						store.addListener( 'stream-ending', mockCloseListener );
						store.addListener( 'data-changed', mockChangeListener );
						store.setState({ age: 55 });
						expect( mockChangeListener ).toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						mockChangeListener.mockClear();
						store.removeListener( 'stream-ending', mockCloseListener );
						store.removeListener( 'data-changed', mockChangeListener );
						store.setState({ name: { first: 'Janet' } });
						expect( mockChangeListener ).not.toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						store.endStream();
						expect( mockChangeListener ).not.toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
					} );
					test( 'attempt to remove listeners for unknown events is not allowed', () => {
						const store = ctx.stream();
						expect(() => {
							// @ts-expect-error
							store.removeListener( 'someEvent', () => {} );
						} ).toThrow();
						store.endStream();
					} )
				} );
				describe( 'LiveStore.resetState', () => {
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

								store.endStream();

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

								store.endStream();

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

								store.endStream();

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

								store.endStream();

								ctx.dispose();
							} );
						} );
					} );
				} );
				describe( 'LiveStore.setState', () => {
					test( 'commits any updates to the context', () => {
						const immutable = new AutoImmutable( createSourceData() as Partial<SourceData> );
						const ctx = new EagleEyeContextClass( immutable );
						const store = ctx.stream();
						const defaultState = createSourceData();
						expect( store.data ).toEqual({}); // no selectormap under observation
						
						expect( ctx.store.getState() ).toEqual( defaultState );
						store.setState({
							friends: { [ MOVE_TAG ]: [ -1, 1 ] } as unknown as Array<any>,
							isActive: true,
							history: {
								places: {
									'2': {
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
						
						store.endStream();

						ctx.dispose();
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
	} );
} );
