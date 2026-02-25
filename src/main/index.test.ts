import {
	AccessorResponse,
	Immutable
} from '@webkrafters/auto-immutable';

import {
	Phase,
	ShutdownReason,
	type BaseStream,
	type IStorage,
	type Prehooks,
	type SelectorMap,
	type State
} from '..';

import getProperty from '@webkrafters/get-property';

import * as AutoImmutableModule from '@webkrafters/auto-immutable';

import clonedeep from '@webkrafters/clone-total';

import { MemoryStorage as TestStorage } from '../model/storage';

import {
	ACCESS_SYM,
	createEagleEye,
	EagleEyeContext as EagleEyeContextClass,
	Channel,
	mkReadonly,
} from '.';

import { isReadonly } from '../test-artifacts/utils';

import createSourceData, {
	type SourceData
} from '../test-artifacts/data/create-state-obj';

import {
	CLEAR_TAG,
	DELETE_TAG,
	FULL_STATE_SELECTOR,
	MOVE_TAG,
	REPLACE_TAG
} from '../constants';

const { default: AutoImmutable } = AutoImmutableModule;

function getMockStorage<T extends State>( data : Partial<T> ) {
	const _storage =  new TestStorage<T>();
	return {
		clone: jest.fn().mockImplementation( d => _storage.clone( d ) ),
		getItem: jest.fn().mockImplementation( k => _storage.getItem( k ) ),
		removeItem: jest.fn().mockImplementation( k => _storage.removeItem( k ) ),
		setItem: jest.fn().mockImplementation(( k, v ) => _storage.setItem( k, v ) )
	} as IStorage<T>;
}

afterEach(() => jest.useRealTimers());
beforeEach(() => jest.useFakeTimers());

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
	describe( 'EagleEyeContext.createInternalStore(...)', () => {
		let context : EagleEyeContextClass;
		beforeAll(() => { context = new EagleEyeContextClass() });
		afterAll(() => { context.dispose() });
		test( 'throws exception by default', () => {
			expect(() => context.createInternalStore()).toThrow(
				'May not create internal stores out of context. Please use `this.store` to obtain externally available store reference.'	
			);
		} );
		test( 'requires the proper access token to create dedicated internal store', () => {
			expect(() => context.createInternalStore( Symbol( ACCESS_SYM.description ) )).toThrow(
				'May not create internal stores out of context. Please use `this.store` to obtain externally available store reference.'	
			);
			expect(() => context.createInternalStore( Symbol( ACCESS_SYM.toString() ) )).toThrow(
				'May not create internal stores out of context. Please use `this.store` to obtain externally available store reference.'	
			);
			const newInternalStore = context.createInternalStore( ACCESS_SYM );
			expect( newInternalStore ).not.toBe( context.store );
			expect( context.store ).toEqual({
    			resetState: expect.any( Function ),
				setState: expect.any( Function ),
				getState: expect.any( Function ),
				subscribe: expect.any( Function )
			})
			expect( newInternalStore ).toEqual({
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
		let sourceData : SourceData;
		let storage : IStorage<SourceData>;
		let context : EagleEyeContextClass<SourceData>;
		let prehooks : Prehooks<SourceData>;
		beforeAll(() => {
			storage = getMockStorage( null as unknown as SourceData );
			prehooks = {};
			sourceData = createSourceData();
			context = new EagleEyeContextClass( sourceData, prehooks, storage );
		});
		afterAll(() => context.dispose() )
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

				// lost connection to the underlying cache
				ctx.store.setState({ c: 66 });
				expect( connection.get() ).toBeUndefined();
				expect( ctx.store.getState() ).toBeUndefined();
			} );
		} );
		describe( 'EagleEyeContext.prehooks', () => {
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
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

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
						const channel = ctx.stream();
						channel.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });
						channel.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({});

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
				} );
				describe( 'when `resetState` prehook exists on the context', () => {
					test( 'is called by the `store.resetState` method', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

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
							CLEAR_TAG,
							{
								current: { any: 'thing' },
								original: {}
							}
						);
						prehooks.resetState.mockClear();

						// also applies to stream generated updates
						const channel = ctx.stream();
						channel.setState({ any: 'thing' });
						channel.resetState([ FULL_STATE_SELECTOR ]);
						expect( prehooks.resetState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.resetState ).toHaveBeenCalledWith(
							CLEAR_TAG,
							{
								current: { any: 'thing' },
								original: {}
							}
						);

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
					test( 'completes `store.resetState` method call if `resetState` prehook returns TRUTHY', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

						const ctx = new EagleEyeContextClass( undefined, {
							resetState: jest.fn().mockReturnValue( true )
						} );

						connectSetSpy.mockClear();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						ctx.store.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({});

						// also applies to stream generated updates
						const channel = ctx.stream();
						channel.setState({ any: 'thing' });
						connectSetSpy.mockClear();
						channel.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({});

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
					test( 'aborts `store.resetState` method call if `resetState` prehook returns FALSY', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

						const ctx = new EagleEyeContextClass( undefined, {
							resetState: jest.fn().mockReturnValue( false )
						} );
						
						connectSetSpy.mockClear();
						
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
						const channel = ctx.stream();
						channel.setState({ from: 'stream' });
						connectSetSpy.mockClear();
						channel.resetState([ FULL_STATE_SELECTOR ]);
						expect( connectSetSpy ).not.toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({
							any: 'thing', from: 'stream'
						});

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
				} );
			} );
			describe( 'setState prehook', () => {
				describe( 'when `setState` prehook does not exist on the context', () => {
					test( 'completes `store.setState` method call', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

						const ctx = new EagleEyeContextClass();
						
						connectSetSpy.mockClear();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });

						// also applies to stream generated updates
						const channel = ctx.stream();
						channel.setState({ from: 'stream' });
						expect( ctx.store.getState() ).toEqual({
							any: 'thing', from: 'stream'
						});

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
				} );
				describe( 'when `setState` prehook exists on the context', () => {
					test( 'is called by the `store.setState` method', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

						const prehooks = Object.freeze({
							setState: jest.fn().mockReturnValue( false )
						});
						const ctx = new EagleEyeContextClass( undefined, prehooks );
						
						connectSetSpy.mockClear();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( prehooks.setState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.setState ).toHaveBeenCalledWith({ any: 'thing' });
						prehooks.setState.mockClear();

						// also applies to stream generated updates
						const channel = ctx.stream();
						channel.setState({ from: 'stream' });
						expect( prehooks.setState ).toHaveBeenCalledTimes( 1 );
						expect( prehooks.setState ).toHaveBeenCalledWith({ from: 'stream' });

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
					test( 'completes `store.setState` method call if `setState` prehook returns TRUTHY', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );

						const ctx = new EagleEyeContextClass( undefined, {
							setState: jest.fn().mockReturnValue( true )
						});
						
						connectSetSpy.mockClear();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( connectSetSpy ).toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({ any: 'thing' });

						// also applies to stream generated updates
						const channel = ctx.stream();
						channel.setState({ from: 'stream' });
						expect( connectSetSpy ).toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({
							any: 'thing', from: 'stream'
						});

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
					test( 'aborts `store.setState` method call if `setState` prehook returns FALSY', () => {
						const cache = new AutoImmutable({});
						const connection = cache.connect();
						const connectSetSpy = jest.spyOn( connection, 'set' );
						const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
						AutoImmutableSpy.mockReturnValue( connection );
						
						const ctx = new EagleEyeContextClass( undefined, {
							setState: jest.fn().mockReturnValue( false )
						} );
						
						connectSetSpy.mockClear();
						
						// applies to externally generated updates
						ctx.store.setState({ any: 'thing' });
						expect( connectSetSpy ).not.toHaveBeenCalled();
						connectSetSpy.mockClear();
						expect( ctx.store.getState() ).toEqual({});

						// also applies to stream generated updates
						const channel = ctx.stream();
						channel.setState({ from: 'stream' });
						expect( connectSetSpy ).not.toHaveBeenCalled();
						expect( ctx.store.getState() ).toEqual({});

						channel.endStream();

						ctx.dispose();

						connectSetSpy.mockRestore();
						AutoImmutableSpy.mockRestore();
					} );
				} );
			} );
			test( 'ignores unknown prehooks', () => {
				const cache = new AutoImmutable({});
				const connection = cache.connect();
				const connectGetSpy = jest.spyOn( connection, 'get' ).mockReturnValue({});
				const connectSetSpy = jest.spyOn( connection, 'set' ).mockReturnValue( undefined );
				const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
				AutoImmutableSpy.mockReturnValue( connection );

				const prehooksMock = {
					testing: jest.fn()
				} as Prehooks<SourceData>;
				
				const ctx = new EagleEyeContextClass<any>( undefined, prehooksMock );
				
				connectSetSpy.mockClear();
				
				// applies to externally generated updates
				ctx.store.setState({ any: 'thing' });
				expect(( prehooksMock as any ).testing ).not.toHaveBeenCalled();
				ctx.store.resetState([ 'any' ]);
				expect(( prehooksMock as any ).testing ).not.toHaveBeenCalled();

				// also applies to stream generated updates
				const channel = ctx.stream();
				channel.setState([ 'stream' ]);
				expect(( prehooksMock as any ).testing ).not.toHaveBeenCalled();
				channel.resetState([ 'stream' ]);
				expect(( prehooksMock as any ).testing ).not.toHaveBeenCalled();

				channel.endStream();

				ctx.dispose();

				connectGetSpy.mockRestore();
				connectSetSpy.mockRestore();
				AutoImmutableSpy.mockRestore();
			} );
			test( 'throws on non-boolean returning prehooks', () => {
				const cache = new AutoImmutable({});
				const connection = cache.connect();
				const connectGetSpy = jest.spyOn( connection, 'get' ).mockReturnValue({});
				const connectSetSpy = jest.spyOn( connection, 'set' ).mockReturnValue( undefined );
				const AutoImmutableSpy = jest.spyOn( AutoImmutable.prototype, 'connect' );
				AutoImmutableSpy.mockReturnValue( connection );
				
				const ctx = new EagleEyeContextClass<any>( undefined, {
					resetState: jest.fn().mockReturnValue( expect.anything() ),
					setState: jest.fn().mockReturnValue( expect.anything() )
				} );
				
				connectSetSpy.mockClear();
				
				// applies to externally generated updates
				expect(() => ctx.store.setState({ any: 'thing' }))
					.toThrow( '`setState` prehook must return a boolean value.' );
				expect(() => ctx.store.resetState([ 'any' ]))
					.toThrow( '`resetState` prehook must return a boolean value.' );

				// also applies to stream generated updates
				const channel = ctx.stream();
				expect(() => channel.setState([ 'stream' ]))
					.toThrow( '`setState` prehook must return a boolean value.' );
				expect(() => channel.resetState([ 'stream' ]))
					.toThrow( '`resetState` prehook must return a boolean value.' );

				channel.endStream();

				ctx.dispose();

				connectGetSpy.mockRestore();
				connectSetSpy.mockRestore();
				AutoImmutableSpy.mockRestore();
			} );
		} );
		describe( 'EagleEyeContext.storage', () => {
			test( 'can be set and retrieved', () => {
				const currentStorage = context.storage;
				expect( currentStorage ).toBe( storage );
				const newStorage = getMockStorage( undefined as unknown as SourceData );
				context.storage = newStorage;
				expect( context.storage ).not.toBe( currentStorage );
				expect( context.storage ).toBe( newStorage );
			} );
			test( 'change transfers value from old storage to the new', () => {
				const sourceData = createSourceData();
				const context = new EagleEyeContextClass(
					createSourceData(),
					{},
					getMockStorage( null as unknown as SourceData )
				);
				
				const currentStorage = context.storage;
				const data = currentStorage.getItem( null );
				const newStorage = getMockStorage( undefined as unknown as SourceData );
				expect( data ).toStrictEqual( sourceData );
				expect( newStorage.getItem( null ) ).toBeNull();
				context.storage = newStorage;
				expect( currentStorage.getItem( null ) ).toBeNull();
				expect( newStorage.getItem( null ) ).toBe( data );
				
				context.dispose();
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
				ctx.dispose();
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
				test( 'updates are propagated to the store and to all streaming channels', () => {
					const ctx = new EagleEyeContextClass( createSourceData() );
					const channel1 = ctx.stream({
						b: 'balance',
						f: 'name.first',
						g: 'gender'
					});
					const channel2 = ctx.stream([
						'phone.country',
						'phone.area',
						'phone.local',
						'phone.line'
					]);
					expect( channel1.data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( channel2.data ).toEqual({
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
					expect( channel1.data ).toEqual({
						b: '$3,311.66',
						f: 'Imagene',
						g: 'female'
					});
					expect( channel2.data ).toEqual({
						0: '+1',
						1: '212',
						2: '555',
						3: '5000'
					});
					channel1.endStream();
					channel2.endStream();
					ctx.dispose();
				} );
				test( 'can reset state and propagate to the store and to all streaming components', () => {
					const cache = new AutoImmutable( sourceData );
					const connection = cache.connect();
					const setSpy = jest.spyOn( connection, 'set' );
					const connectSpy = jest
						.spyOn( AutoImmutable.prototype, 'connect' )
						.mockReturnValue( connection );
;					const ctx = new EagleEyeContextClass( sourceData );
					const channel1  = ctx.stream({
						b: 'balance',
						f: 'name.first',
						g: 'gender'
					});
					const channel2  = ctx.stream([
						'phone.country',
						'phone.area',
						'phone.local',
						'phone.line',
						FULL_STATE_SELECTOR
					]);
					
					expect( channel1 .data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( channel2 .data ).toEqual({
						0: '+1',
						1: '947',
						2: '552',
						3: '2282',
						4: sourceData
					});
					expect( ctx.store.getState([ 'newProperty' ]) )
						.toEqual({ newProperty: undefined });
					
					ctx.store.setState({
						name: {
							first: 'Imagene'
						} as SourceData["name"],
						phone: {
							area: '212',
							line: '5000',
							local: '555'
						} as SourceData["phone"],
						newProperty: 'some test value'
					} as AutoImmutableModule.Changes<SourceData>);

					expect( channel1 .data ).toEqual({
						b: '$3,311.66',
						f: 'Imagene',
						g: 'female'
					});
					expect( channel2 .data ).toEqual({
						0: '+1',
						1: '212',
						2: '555',
						3: '5000',
						4: {
							...sourceData,
							name: {
								...sourceData.name,
								first: 'Imagene'
							},
							phone: {
								...sourceData.phone,
								area: '212',
								line: '5000',
								local: '555'
							},
							newProperty: 'some test value'
						}
					});
					expect( ctx.store.getState([ 'newProperty' ]) )
						.toEqual({ newProperty: 'some test value' });

					ctx.store.resetState([ FULL_STATE_SELECTOR ]);

					expect( channel1 .data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( channel2 .data ).toEqual({
						0: '+1',
						1: '947',
						2: '552',
						3: '2282',
						4: sourceData
					});
					expect( ctx.store.getState() ).toEqual( sourceData );
					expect( ctx.store.getState([ 'newProperty' ]) )
						.toEqual({ newProperty: undefined });

					channel2 .setState({
						friends: {
							1: {
								age: 44,
								name: {
									middles: [ 'Ruth' ]
								}
							}
						}
					} as unknown as AutoImmutableModule.Changes<SourceData> );

					expect( channel1 .data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( channel2 .data ).toEqual({
						0: '+1',
						1: '947',
						2: '552',
						3: '2282',
						4: {
							...sourceData,
							friends: [
								sourceData.friends[ 0 ],
								{
									...sourceData.friends[ 1 ],
									age: 44,
									name: {
										...sourceData.friends[ 1 ].name,
										middles: [ 'Ruth' ]
									}
								},
								...sourceData.friends.slice( 2 )
							]
						}
					});

					setSpy.mockClear();
					ctx.store.resetState([
						'friends.1.age',
						'friends.1',
						'friends.1.name.middles',
						'friends.8',
						'name',
						'friends.1.age',
						'friends.8.name',
						'name.first',
						'friends.1'
					]);
					expect( setSpy ).toHaveBeenCalledWith({
						friends: {
							1: {
								'@@REPLACE': {
									id: 1,
									name: {
										first: 'Holly',
										last: 'Roberson'
									}
								}
							},
							'@@DELETE': [ '8' ]
						},
						name: {
							'@@REPLACE': {
								first: 'Amber',
								last: 'Sears'
							}
						}
					}, expect.any( Function ));

					expect( channel1 .data ).toEqual({
						b: '$3,311.66',
						f: 'Amber',
						g: 'female'
					});
					expect( channel2 .data ).toEqual({
						0: '+1',
						1: '947',
						2: '552',
						3: '2282',
						4: sourceData
					});
					expect( ctx.store.getState() ).toEqual( sourceData );

					setSpy.mockRestore();
					connectSpy.mockRestore();
					
					channel1 .endStream();
					channel2 .endStream();
					ctx.dispose();
					connection.disconnect();
					cache.close();
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
					const channel = ctx.stream();
					channel.setState({ company: NEW_CNAME });
					expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({ company: NEW_CNAME });
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'company' ]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({ company: NEW_CNAME });
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					
					const NEW_CNAME2 = 'Alright! let me tell you what\'s what!!!!!';
					const channel2  = ctx.stream();
					channel2 .setState({ company: NEW_CNAME2 });
					expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({ company: NEW_CNAME2 });
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[ 'company' ]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual({ company: NEW_CNAME2 });
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					
					channel.resetState([ FULL_STATE_SELECTOR ]);
					expect( onChangeMock ).toHaveBeenCalledTimes( 1 );
					expect( onChangeMock.mock.calls[ 0 ][ 0 ] ).toEqual({[ REPLACE_TAG ]: sourceData });
					expect( onChangeMock.mock.calls[ 0 ][ 1 ] ).toEqual([[]]);
					expect( onChangeMock.mock.calls[ 0 ][ 2 ] ).toEqual( sourceData );
					expect( onChangeMock.mock.calls[ 0 ][ 3 ] ).toEqual( expect.any( Function ) );
					onChangeMock.mockClear();
					
					unsub(); // unsubscribe store change listener
					channel2 .setState({
						company: 'Geez! Did you get the name I sent ya?????'
					});
					expect( onChangeMock ).not.toHaveBeenCalled();

					channel.endStream();
					channel2 .endStream();

					ctx.dispose();
				} );
			} );
		} );
		describe( 'EagleEyeContext.stream', () => {
			test( 'provides change stream', () => {
				expect( context.stream ).toEqual( expect.any( Function ) );
			} );
			test( "invocation returns an observable change stream channel 'an automatically updating store'", () => {
				expect( context.stream() ).toBeInstanceOf( Channel );
			} );
			test( 'in isolation, maintains communication with the context', () => {
				const ctx = new EagleEyeContextClass({});

				expect( ctx.store.getState() ).toEqual({});
				ctx.store.setState({ b: 22 });
				const useStream = ctx.stream;
				const channel_0  = useStream({
					anchor: 'a'
				});
				const channel_1  = useStream({
					myRes : 'b',
					testVal: 'a'
				});

				expect( ctx.store.getState() ).toEqual({
					b: 22
				});
				expect( channel_0 .data ).toEqual({
					anchor: undefined
				});
				expect( channel_1 .data ).toEqual({
					myRes : 22,
					testVal: undefined
				});
				ctx.store.setState({ a: 1024 });

				expect( ctx.store.getState() ).toEqual({
					a: 1024,
					b: 22
				});
				expect( channel_0 .data ).toEqual({
					anchor: 1024
				});
				expect( channel_1 .data ).toEqual({
					myRes : 22,
					testVal: 1024
				});
				
				channel_0 .endStream();
				channel_1 .endStream();

				ctx.dispose();
			} );
			describe( "change stream channel", () => {
				let selectorMapOnRender : {
					year3: 'history.places[2].year',
					isActive: 'isActive',
					tag6: 'tags[5]'
				};
				beforeAll(() => {
					selectorMapOnRender = {
						year3: 'history.places[2].year',
						isActive: 'isActive',
						tag6: 'tags[5]'
					};
				});
				test( 'returns a channel observing the labeled state slices', () => {
					const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
					const channel = ctx0.stream({
						all: FULL_STATE_SELECTOR,
						tags: 'tags'
					});
					expect( channel ).toBeInstanceOf( Channel );
					expect( channel.data ).toEqual({
						all: sourceData,
						tags: sourceData.tags
					}),
					expect( channel.streaming ).toBe( true );
					channel.endStream();
					ctx0.dispose();
				} );
				describe( 'events', () => {
					describe( 'stream-ending', () => {
						test( "invoked at the end of channel's streaming phase", () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream();
							const closeHandler = jest.fn();
							channel.addListener( 'stream-ending', closeHandler );
							expect( closeHandler ).not.toHaveBeenCalled();
							channel.endStream();
							expect( closeHandler ).toHaveBeenCalled();
							ctx.dispose();
						} );
						test( 'invoked with a user level message at normal closure', () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream();
							const closeHandler = jest.fn();
							channel.addListener( 'stream-ending', closeHandler );
							channel.endStream();
							expect( closeHandler ).toHaveBeenCalledWith( ShutdownReason.LOCAL );
							ctx.dispose();
						} );
						test( 'is invoked with a cache level message when closing due to downstream cache closure', () => {
							const cache = new AutoImmutable( createSourceData() );
							const ctx = new EagleEyeContextClass( cache );
							const channel = ctx.stream();
							const closeHandler = jest.fn();
							channel.addListener( 'stream-ending', closeHandler );
							expect( channel.streaming ).toBe( true );
							ctx.cache.close();
							expect( channel.streaming ).toBe( false );
							expect( closeHandler ).toHaveBeenCalledWith( ShutdownReason.CACHE );
							ctx.dispose();
						} );
						test( 'is invoked with a context level message when closing due to context disposal', () => {
							const cache = new AutoImmutable( createSourceData() );
							const ctx = new EagleEyeContextClass( cache );
							const channel = ctx.stream();
							const closeHandler = jest.fn();
							channel.addListener( 'stream-ending', closeHandler );
							expect( channel.streaming ).toBe( true );
							ctx.dispose();
							expect( channel.streaming ).toBe( false );
							expect( closeHandler ).toHaveBeenCalledWith( ShutdownReason.CONTEXT );
						} );
					} );
					describe( 'data-changed', () => {
						test( 'invoked whenever store.data changes', () => {
							const selectorMap = {
								company: 'company',
								lineDigits: 'phone.line'
							};
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream( selectorMap );
							expect( channel.data ).toEqual({
								company: 'VORTEXACO',
								lineDigits: '2282'
							});
							const changeHandler = jest.fn();
							channel.addListener( 'data-changed', changeHandler );
							expect( changeHandler ).not.toHaveBeenCalled();
							channel.setState({ isActive: true }); // change to global ctx did not affect stream
							expect( channel.data ).toEqual({
								company: 'VORTEXACO',
								lineDigits: '2282'
							});
							expect( changeHandler ).not.toHaveBeenCalled();
							channel.setState({ phone: { line: '2300' } }); // change to global ctx affects stream
							expect( channel.data ).toEqual({
								company: 'VORTEXACO',
								lineDigits: '2300'
							});
							expect( changeHandler ).toHaveBeenCalledTimes( 1 );
							changeHandler.mockClear();
							// affects stream by altering its observed selector map
							channel.selectorMap = [ 'company', 'phone.line' ] as unknown as typeof selectorMap; 
							expect( channel.data ).toEqual({
								0: 'VORTEXACO',
								1: '2300'
							});
							expect( changeHandler ).toHaveBeenCalledTimes( 1 );
							changeHandler.mockClear();
							channel.endStream();
							ctx.dispose();
						} );
					} );
				} );
				describe( 'properties', () => {
					describe( 'Channel.closed', () => {
						test( 'is flag set when the live connection to data source is severed', () => {
							const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx0.stream();
							expect( channel.closed ).toBe( false );
							channel.endStream();
							expect( channel.closed ).toBe( true );
							ctx0.dispose();
						} );
					} );
					describe( 'Channel.data', () => {
						test( 'carries the latest state data as referenced by the selectorMap', () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream({
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
							expect( channel.data ).toEqual( expectedValue );
							channel.setState({
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
							expect( channel.data ).toEqual({
								...expectedValue,
								city3: 'Marakesh',
								country3: 'Morocco',
								friends: [ 0, 2, 1 ].map( i => defaultState.friends[ i ] ),
								isActive: true,
								tag6: undefined,
								tag7: undefined,
								tags: [ 0, 1, 2, 4, 6 ].map( i => defaultState.tags[ i ] )
							});
							channel.endStream();
							ctx.dispose();
						} );
						test( 'holds the complete current state object whenever `@@STATE` entry appears in the selectorMap', () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream({
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
							expect( channel.data ).toEqual( expectedValue );
							channel.setState({
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
							expect( channel.data ).toEqual({
								...expectedValue,
								city3: 'Marakesh',
								country3: 'Morocco',
								isActive: true,
								state: updatedDataEquiv
							});
							channel.endStream();
							ctx.dispose();
						} );
						test( 'holds an empty object when no renderKeys provided ', async () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream();
							expect( channel.data ).toEqual({});
							channel.setState({ // can still update state
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
							expect( channel.data ).toEqual({});
							channel.endStream();
							ctx.dispose();
						} );
						test( 'does not update for resubmitted changes', async () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream({ company: 'company', fn: 'name.first' });
							expect( channel.data ).toEqual({
								company: 'VORTEXACO',
								fn: 'Amber'
							});
							channel.setState({
								company: 'New Company',
								name: {
									first: 'Jack'
								} as SourceData[ "name" ]
							} );
							const currStoreData = channel.data;
							expect( channel.data ).toEqual({
								company: 'New Company',
								fn: 'Jack'
							});
							channel.setState({
								company: 'New Company',
								gender: 'Male',
								name: {
									first: 'Jack',
									last: 'Franken'
								}
							} );
							expect( channel.data ).toBe( currStoreData );
							channel.endStream();
							ctx.dispose();
						} );
						test( 'does not respond to changes not affecting it', async () => {
							const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx.stream({ company: 'company', fn: 'name.first' });
							expect( channel.data ).toEqual({
								company: 'VORTEXACO',
								fn: 'Amber'
							});
							const currChannelData = channel.data;
							channel.setState({
								gender: 'Male',
								name: {
									last: 'Franken'
								} as SourceData["name"]
							} );
							expect( channel.data ).toBe( currChannelData );
							channel.endStream();
							ctx.dispose();
						} );
					} );
					describe( 'Channel.phase', () => {
						test( "keeps track of the channel's current lifecycle", () => {
							const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx0.stream();
							channel.addListener( 'stream-ending', () => {
								expect( channel.phase ).toBe( Phase.CLOSING );
							} );
							expect( channel.phase ).toBe( Phase.OPENED );
							channel.endStream();
							expect( channel.phase ).toBe( Phase.CLOSED );
							ctx0.dispose();
						} );
					} );
					describe( 'Channel.selectorMap', () => {
						let selectorMapOnRerender : typeof selectorMapOnRender & { country3 : "history.places[2].country" };
						let mockGetReturnValue : AccessorResponse<SourceData>;
						beforeAll(() => {
							selectorMapOnRerender = clonedeep( selectorMapOnRender );
							selectorMapOnRerender.country3 = 'history.places[2].country';
							mockGetReturnValue = Array.from( new Set(
								Object.values( selectorMapOnRender ).concat(
									Object.values( selectorMapOnRerender ) as any[]
								)
							) ).reduce(( o : Record<string, unknown>, k ) => {
								o[ k ] = null;
								return o;
							}, {}) as typeof mockGetReturnValue;
						});
						describe( 'normal flow', () => {
							test( 'adjusts the channel on selctorMap change', () => {
								const origSelectorMap = {
									all: FULL_STATE_SELECTOR,
									tags: 'tags'
								};
								type OrigSelectorMap = typeof origSelectorMap;
								const _selectorMapOnRender = {
									...selectorMapOnRender,
									company: 'company'
								};
								const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
								const channel = ctx0.stream( origSelectorMap );
								channel.selectorMap = _selectorMapOnRender as unknown as OrigSelectorMap;
								expect( Object.keys( channel.data ) )
									.toEqual( Object.keys( _selectorMapOnRender ));
								channel.selectorMap = selectorMapOnRerender as unknown as OrigSelectorMap;
								expect( Object.keys( channel.data ) )
									.toEqual( Object.keys( selectorMapOnRerender ));
								channel.endStream();
								ctx0.dispose();
							});
							test( 'destroys previous and obtains new connection', () => {
								const cache = new AutoImmutable( sourceData );
								const connection = cache.connect();
								const disconnectSpy = jest.spyOn( connection, 'disconnect' );
								const getSpy = jest
									.spyOn( connection, 'get' )
									.mockReturnValue( mockGetReturnValue );
								const connectSpy = jest
									.spyOn( AutoImmutable.prototype, 'connect' )
									.mockReturnValue( connection );

								const ctx = new EagleEyeContextClass( sourceData );

								connectSpy.mockClear();
								disconnectSpy.mockClear();

								const channel = ctx.stream( selectorMapOnRender );

								expect( connectSpy ).toHaveBeenCalledTimes( 1 );
								expect( disconnectSpy ).not.toHaveBeenCalled();

								channel.selectorMap = selectorMapOnRerender as unknown as typeof selectorMapOnRender;
								
								expect( connectSpy ).toHaveBeenCalledTimes( 2 );
								expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );

								disconnectSpy.mockRestore();
								getSpy.mockRestore();
								connectSpy.mockRestore();

								channel.endStream();

								ctx.dispose();
							});
							describe( 'when the new selectorMap is not empty', () => {
								test( 'refreshes state data', () => {
									const cache = new AutoImmutable( sourceData );
									const connection = cache.connect();
									const getSpy = jest
										.spyOn( connection, 'get' )
										.mockReturnValue( mockGetReturnValue );
									const connectSpy = jest
										.spyOn( AutoImmutable.prototype, 'connect' )
										.mockReturnValue( connection );

									const ctx = new EagleEyeContextClass( sourceData );

									getSpy.mockClear();

									const channel = ctx.stream( selectorMapOnRender );

									expect( getSpy ).toHaveBeenCalledTimes( 1 );
									expect( getSpy ).toHaveBeenCalledWith(
										...Object.values( selectorMapOnRender )
									);
									getSpy.mockClear();

									channel.selectorMap = selectorMapOnRerender;

									expect( getSpy ).toHaveBeenCalledTimes( 1 );
									expect( getSpy ).toHaveBeenCalledWith(
										...Object.values( selectorMapOnRerender )
									);

									getSpy.mockRestore();
									connectSpy.mockRestore();

									channel.endStream();

									ctx.dispose();
								});
								test( 'sets up new subscription with the store', () => {
									const mockSubscribe = jest.fn()
									const mockUnsubscribe = jest.fn();

									class TestLiveStore<S extends SelectorMap> extends Channel<SourceData,S>{
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

									const channel = ctx.stream( selectorMapOnRender );

									expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									channel.selectorMap = selectorMapOnRerender;

									expect( mockSubscribe ).toHaveBeenCalledTimes( 2 );
									expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

									channel.endStream();
									
									ctx.dispose();
								});
							});
						} );
						describe( 'accepting an array of propertyPaths in place of a selector map', () => {
							test( 'produces an indexed-based context state data object', () => {
								const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
								const channel = ctx0.stream([
									...Object.values( selectorMapOnRender ),
									FULL_STATE_SELECTOR
								]);
								const stateSource = createSourceData();
								expect( channel.data ).toStrictEqual({
									0: stateSource.history.places[ 2 ].year,
									1: stateSource.isActive,
									2: stateSource.tags[ 5 ],
									3: stateSource
								});
								channel.endStream();
								ctx0.dispose();
							} );
						} );
						describe( 'when the new selectorMap is empty', () => {
							describe( 'and existing data is not empty', () => {
								test( 'adjusts the channel on selectorMap change', () => {
									const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
						
									const channel = ctx0.stream( selectorMapOnRender );
									expect( Object.keys( channel.data ) )
										.toEqual( Object.keys( selectorMapOnRender ));
									channel.selectorMap = {} as unknown as typeof selectorMapOnRender;
									expect( channel.data ).toEqual({});
									channel.endStream();
									ctx0.dispose();
								} );
								test( 'destroys previous and obtains new connection', () => {
									const cache = new AutoImmutable( sourceData );
									const connection = cache.connect();
									const disconnectSpy = jest.spyOn( connection, 'disconnect' );
									const getSpy = jest
										.spyOn( connection, 'get' )
										.mockReturnValue( mockGetReturnValue );
									const connectSpy = jest
										.spyOn( AutoImmutable.prototype, 'connect' )
										.mockReturnValue( connection );
									const ctx = new EagleEyeContextClass( sourceData );
									const streamSpy = jest
										// @ts-expect-error
										.spyOn( EagleEyeContextClass.prototype, 'stream', 'get' )
										// @ts-expect-error
										.mockReturnValue( s => new Channel( ctx, s ));

									connectSpy.mockClear();
									disconnectSpy.mockClear();

									const channel = ctx.stream( selectorMapOnRender );

									expect( connectSpy ).toHaveBeenCalledTimes( 1 );
									expect( disconnectSpy ).not.toHaveBeenCalled();

									connectSpy.mockClear();

									channel.selectorMap = selectorMapOnRerender;
									
									expect( connectSpy ).toHaveBeenCalledTimes( 1 );
									expect( disconnectSpy ).toHaveBeenCalledTimes( 1 );

									connectSpy.mockRestore();
									disconnectSpy.mockRestore();
									getSpy.mockRestore();
									streamSpy.mockRestore();

									channel.endStream();

									ctx.dispose();
								} );
								test( 'refreshes state data with empty object', () => {
									const cache = new AutoImmutable( sourceData );
									const connection = cache.connect();
									const getSpy = jest
										.spyOn( connection, 'get' )
										.mockReturnValue( mockGetReturnValue );
									const connectSpy = jest
										.spyOn( AutoImmutable.prototype, 'connect' )
										.mockReturnValue( connection );
									const ctx = new EagleEyeContextClass( sourceData );
									const streamSpy = jest
										// @ts-expect-error
										.spyOn( EagleEyeContextClass.prototype, 'stream', 'get' )
										// @ts-expect-error
										.mockReturnValue( s => new Channel( ctx, s ));

									getSpy.mockClear();

									const channel = ctx.stream( selectorMapOnRender );

									expect( getSpy ).toHaveBeenCalledTimes( 1 );
									expect( getSpy ).toHaveBeenCalledWith(
										...Object.values( selectorMapOnRender )
									);
									getSpy.mockClear();

									channel.selectorMap = undefined as unknown as typeof selectorMapOnRender;
									
									expect( getSpy ).not.toHaveBeenCalled();

									expect( channel.data ).toEqual({});

									connectSpy.mockRestore();
									getSpy.mockRestore();
									streamSpy.mockRestore();

									channel.endStream();

									ctx.dispose();
								} );
								test( 'does not set up new subscription with the store', () => {
									const mockSubscribe = jest.fn()
									const mockUnsubscribe = jest.fn();

									class TestLiveStore<S extends SelectorMap> extends Channel<SourceData,S>{
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

									const channel = ctx.stream( selectorMapOnRender );

									expect( mockSubscribe ).toHaveBeenCalledTimes( 1 );
									expect( mockUnsubscribe ).not.toHaveBeenCalled();
									mockSubscribe.mockClear();

									channel.selectorMap = undefined as unknown as typeof selectorMapOnRender;

									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).toHaveBeenCalledTimes( 1 );

									channel.endStream();

									ctx.dispose();
								} );
							} );
							describe( 'and existing data is empty', () => {
								test( 'leaves the channel as-is on selctorMap change', () => {
									const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
									const channel = ctx0.stream();
									const _origData = channel.data as typeof mockGetReturnValue;
									expect( _origData ).toEqual({});
									channel.selectorMap = undefined;
									expect( channel.data ).toBe( _origData );
									channel.selectorMap = null as unknown as undefined;
									expect( channel.data ).toBe( _origData );
									channel.selectorMap = {};
									expect( channel.data ).toBe( _origData );
									channel.selectorMap = [];
									expect( channel.data ).toBe( _origData );
									channel.endStream();
									ctx0.dispose();
								} );
								test( 'performs no channel data update', async () => {
									const cache = new AutoImmutable( sourceData );
									const connection = cache.connect();
									const getSpy = jest
										.spyOn( connection, 'get' )
										.mockReturnValue( mockGetReturnValue );
									const connectSpy = jest
										.spyOn( AutoImmutable.prototype, 'connect' )
										.mockReturnValue( connection );
									const ctx = new EagleEyeContextClass( sourceData );
									const streamSpy = jest
										// @ts-expect-error
										.spyOn( EagleEyeContextClass.prototype, 'stream', 'get' )
										// @ts-expect-error
										.mockReturnValue(() => new Channel( ctx ));
									expect( getSpy ).not.toHaveBeenCalled();
									
									const channel = ctx.stream();

									expect( getSpy ).not.toHaveBeenCalled();
									expect( channel.data ).toEqual({});
									getSpy.mockClear();

									const existingData = channel.data;

									channel.selectorMap = undefined;

									expect( getSpy ).not.toHaveBeenCalled();
									expect( channel.data ).toEqual( existingData );

									connectSpy.mockRestore();
									getSpy.mockRestore();
									streamSpy.mockRestore();

									channel.endStream();

									ctx.dispose();
								} );
								test( 'does not set up new subscription with the store', () => {
									const mockSubscribe = jest.fn()
									const mockUnsubscribe = jest.fn();

									class TestLiveStore<S extends SelectorMap> extends Channel<SourceData,S>{
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

									const channel = ctx.stream();

									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									channel.selectorMap = {};

									expect( mockSubscribe ).not.toHaveBeenCalled();
									expect( mockUnsubscribe ).not.toHaveBeenCalled();

									channel.endStream();

									ctx.dispose();
								} );
								describe( 'and previous property path is empty', () => {
									test( 'skips refreshing connection: no previous connections to the store existed', () => {
										const mockSubscribe = jest.fn()
										const mockUnsubscribe = jest.fn();

										class TestLiveStore<S extends SelectorMap> extends Channel<SourceData,S>{
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

										const cache = new AutoImmutable( sourceData );
										const connection = cache.connect();
										const disconnectSpy = jest.spyOn( connection, 'disconnect' );
										const getSpy = jest
											.spyOn( connection, 'get' )
											.mockReturnValue( mockGetReturnValue );
										const connectSpy = jest
											.spyOn( AutoImmutable.prototype, 'connect' )
											.mockReturnValue( connection );

										const ctx = new TestEagleEyeContextClass( sourceData );

										connectSpy.mockClear();

										const channel = ctx.stream();
										
										expect( connectSpy ).toHaveBeenCalledTimes( 1 );
										expect( mockSubscribe ).not.toHaveBeenCalled();
										expect( disconnectSpy ).not.toHaveBeenCalled();
										expect( mockUnsubscribe ).not.toHaveBeenCalled();

										connectSpy.mockClear();

										channel.selectorMap = {} as unknown as typeof selectorMapOnRender;

										expect( connectSpy ).not.toHaveBeenCalled();
										expect( mockSubscribe ).not.toHaveBeenCalled();
										expect( disconnectSpy ).not.toHaveBeenCalled();
										expect( mockUnsubscribe ).not.toHaveBeenCalled();

										connectSpy.mockRestore();
										disconnectSpy.mockRestore();
										getSpy.mockRestore();

										channel.endStream();

										ctx.dispose();
									} );
								} );
							} );
						} );
					} );
					describe( 'Channel.streaming', () => {
						test( 'is flag set for a stream-ready channel', () => {
							const ctx0 = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
							const channel = ctx0.stream();
							expect( channel.streaming ).toBe( true );
							channel.endStream();
							expect( channel.streaming ).toBe( false );
							ctx0.dispose();
						} );
					} );
				} );
				describe( 'Channel.addListener', () => {
					test( 'allows for listeners to be added for channel data change and channel closing events', () => {
						const ctx = new EagleEyeContextClass( sourceData as Partial<SourceData> );
						const channel = ctx.stream({ f: 'name.first', y: 'age' });
						const mockChangeListener = jest.fn();
						const mockCloseListener = jest.fn();
						channel.addListener( 'data-changed', mockChangeListener );
						channel.addListener( 'stream-ending', mockCloseListener );
						channel.setState({ age: 55 });
						expect( mockChangeListener ).toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						mockChangeListener.mockClear();
						channel.setState({ name: { first: 'Janet' } });
						expect( mockChangeListener ).toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						mockChangeListener.mockClear();
						channel.endStream();
						expect( mockChangeListener ).not.toHaveBeenCalled();
						expect( mockCloseListener ).toHaveBeenCalled();
						ctx.dispose();
					} );
					test( 'attempt to add listeners for unknown events is disallowed', () => {
						const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
						const channel = ctx.stream();
						expect(() => {
							// @ts-expect-error
							channel.addListener( 'someEvent', () => {} );
						} ).toThrow();
						channel.endStream();
						ctx.dispose();
					} )
				} );
				describe( 'Channel.endStream', () => {
					test( 'severs connection to the global context stream', () => {
						const ctx = new EagleEyeContextClass( sourceData );
						const selectorMap = { regHour: 'registered.time.hours' };
						const dataChangeHandler = jest.fn();
						const channel = ctx.stream( selectorMap );
						channel.addListener( 'data-changed', dataChangeHandler );
						expect( channel.data ).toEqual({ regHour: 9 });
						
						channel.setState({
							registered: {
								month: 7,
								time: {
									hours: 22,
									minutes: 5
								},
								year: 2026
							} as SourceData["registered"]
						});
						expect( dataChangeHandler ).toHaveBeenCalled();
						
						expect( channel.data ).toEqual({ regHour: 22 });
						dataChangeHandler.mockClear();

						// after diposal, the store has no access to the context 
						ctx.dispose();
						channel.setState({
							registered: {
								month: 3,
								time: {
									hours: 16
								}
							} as SourceData["registered"]
						});
						expect( dataChangeHandler ).not.toHaveBeenCalled();
						expect( channel.data ).toEqual({ regHour: 22 }); // instead of 16

						channel.endStream();

						ctx.dispose();

					} );
				} );			
				describe( 'Channel.removeListener', () => {
					test( 'allows for added listeners to be removed for channel data change and channel closing events', () => {
						const ctx = new EagleEyeContextClass( sourceData as Partial<SourceData> );
						
						const channel = ctx.stream({ a: 'age', f: 'name.first' });
						
						const mockChangeListener = jest.fn();
						const mockCloseListener = jest.fn();

						channel.addListener( 'stream-ending', mockCloseListener );
						channel.addListener( 'data-changed', mockChangeListener );

						channel.setState({ age: 55 });
						expect( mockChangeListener ).toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();

						mockChangeListener.mockClear();

						channel.removeListener( 'stream-ending', mockCloseListener );
						channel.removeListener( 'data-changed', mockChangeListener );

						channel.setState({ name: { first: 'Janet' } });
						expect( mockChangeListener ).not.toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						
						channel.endStream();
						
						expect( mockChangeListener ).not.toHaveBeenCalled();
						expect( mockCloseListener ).not.toHaveBeenCalled();
						
						ctx.dispose();
					} );
					test( 'attempt to remove listeners for unknown events is disallowed', () => {
						const ctx = new EagleEyeContextClass( createSourceData() as Partial<SourceData> );
						
						const channel = ctx.stream();

						expect(() => {
							// @ts-expect-error
							channel.removeListener( 'someEvent', () => {} );
						} ).toThrow();

						channel.endStream();
						
						ctx.dispose();
					} )
				} );
				describe( 'Channel.resetState', () => {
					describe( 'when selectorMap is present in the consumer', () => {
						describe( 'and called with own property paths arguments to reset', () => {
							test( 'resets with original slices and removes non-original slices for entries found in property paths', () => {
								const sourceData = createSourceData();
								const cache = new AutoImmutable( sourceData );
								const connection = cache.connect();
								const setSpy = jest.spyOn( connection, 'set' );
								const connectSpy = jest
									.spyOn( AutoImmutable.prototype, 'connect' )
									.mockReturnValue( connection );
								const ctx = new EagleEyeContextClass( sourceData );
								const channel = ctx.stream( selectorMapOnRender );
								setSpy.mockClear();
								channel.resetState([ 'blatant', 'company', 'xylophone', 'yodellers[5]', 'to.the.zenith' ]);
								expect( setSpy ).toHaveBeenCalledTimes( 1 );
								expect( setSpy.mock.calls[ 0 ][ 0 ] ).toEqual({
									[ DELETE_TAG ]: [ 'blatant', 'xylophone', 'yodellers', 'to' ],
									company: { [ REPLACE_TAG ]: sourceData.company }
								});

								connectSpy.mockRestore();
								setSpy.mockRestore();

								channel.endStream();

								ctx.dispose();

								cache.close();
							} );
						} );
						describe( 'and called with NO own property paths argument to reset', () => {
							test( 'calculates setstate changes using state slice matching property paths derived from the selectorMap', () => {
								const sourceData = createSourceData();
								const cache = new AutoImmutable( sourceData );
								const connection = cache.connect();
								const setSpy = jest.spyOn( connection, 'set' );
								const connectSpy = jest
									.spyOn( AutoImmutable.prototype, 'connect' )
									.mockReturnValue( connection );
								const ctx = new EagleEyeContextClass( sourceData );
								const channel = ctx.stream( selectorMapOnRender );
								setSpy.mockClear();
								channel.resetState();
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

								channel.endStream();

								ctx.dispose();

								cache.close();
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
									.spyOn( AutoImmutable.prototype, 'connect' )
									.mockReturnValue( connection );
								const ctx = new EagleEyeContextClass( sourceData );
								const channel = ctx.stream();
								setSpy.mockClear();
								channel.resetState([ 'blatant', 'company', 'xylophone', 'yodellers', 'zenith' ]);
								expect( setSpy ).toHaveBeenCalledTimes( 1 );
								expect( setSpy.mock.calls[ 0 ][ 0 ] ).toEqual({
									[ DELETE_TAG ]: [ 'blatant','xylophone','yodellers','zenith' ],
									company: {
										[ REPLACE_TAG ]: sourceData.company
									},
								});
								connectSpy.mockRestore();
								setSpy.mockRestore();

								channel.endStream();

								ctx.dispose();

								cache.close();
							} );
						} );
						describe( 'and called with NO own property paths arguments to reset', () => {
							test( 'is a noop', () => {
								const cache = new AutoImmutable( createSourceData() );
								const connection = cache.connect();
								const setSpy = jest.spyOn( connection, 'set' );
								const connectSpy = jest.spyOn(
									AutoImmutable.prototype, 'connect'
								).mockReturnValue( connection );
								const ctx = new EagleEyeContextClass( sourceData );
								const channel = ctx.stream();
								setSpy.mockClear();

								channel.resetState();

								expect( setSpy ).not.toHaveBeenCalled();

								connectSpy.mockRestore();
								setSpy.mockRestore();

								channel.endStream();

								ctx.dispose();

								cache.close();
							} );
						} );
					} );
				} );
				describe( 'Channel.setState', () => {
					test( 'commits any updates to the context', () => {
						const defaultState = createSourceData();
						const immutable = new AutoImmutable( defaultState as Partial<SourceData> );
						const ctx = new EagleEyeContextClass( immutable );

						const channel = ctx.stream();
						expect( channel.data ).toEqual({}); // no selectormap under observation
						expect( ctx.store.getState() ).toEqual( defaultState );
						channel.setState({
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
						expectedValue.friends = [ 0, 2, 1 ].map( i => defaultState.friends![ i ] );
						expectedValue.history.places[ 2 ].city = 'Marakesh';
						expectedValue.history.places[ 2 ].country = 'Morocco';
						expectedValue.isActive = true;
						expectedValue.tags = [ 0, 1, 2, 4, 6 ].map( i => defaultState.tags![ i ] );

						expect( ctx.store.getState() ).toEqual( expectedValue );
						expect( channel.data ).toEqual({}); // no selectormap under observation
						
						channel.endStream();

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
