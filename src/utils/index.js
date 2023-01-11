import get from 'lodash.get';
import has from 'lodash.has';
import isPlainObject from 'lodash.isplainobject';

/**
 * Curates the most inclusive propertyPaths from a list of property paths.
 * @example
 * arrangePropertyPaths(["a.b.c.d", "a.b", "a.b.z[4].w", "s.t"]) => ["a.b", "s.t"].
 * "a.b" is inclusive of "a.b.c.d": "a.b.c.d" is a subset of "a.b." but not vice versa.
 * "a.b" is inclusive of "a.b.z[4].w": "a.b.z[4].w" is a subset of "a.b." but not vice versa.
 *
 * @param {Array<string>} propertyPaths
 * @returns {Array<string>}
 */
export function arrangePropertyPaths( propertyPaths ) {
	/** @type {{[propertyPath: string]: Array<string>}} */
	const superPathTokensMap = {};
	for( const path of propertyPaths ) {
		const pathTokens = path
			.replace( /\[([0-9]+)\]/g, '.$1' )
			.replace( /^\./, '' )
			.split( /\./ );
		L2: {
			const replacedSuperPaths = [];
			for( const superPath in superPathTokensMap ) {
				const superPathTokens = superPathTokensMap[ superPath ];
				// self/subset check
				if( superPathTokens.length <= pathTokens.length ) {
					if( superPathTokens.every(( p, i ) => p === pathTokens[ i ]) ) {
						break L2;
					}
				} else {
					// superset check
					pathTokens.every(( p, i ) => p === superPathTokens[ i ]) &&
					replacedSuperPaths.push( superPath );
				}
			}
			superPathTokensMap[ path ] = pathTokens;
			for( const path of replacedSuperPaths ) {
				delete superPathTokensMap[ path ];
			}
		}
	}
	return Object.keys( superPathTokensMap );
};

/**
 * Converts argument to readonly.
 *
 * Note: Mutates original argument.
 *
 * @param {T} v
 * @returns {Readonly<T>}
 * @template T
 */
export function makeReadonly( v ) {
	let frozen = true;
	if( isPlainObject( v ) ) {
		for( const k in v ) { makeReadonly( v[ k ] ) }
		frozen = Object.isFrozen( v );
	} else if( Array.isArray( v ) ) {
		const vLen = v.length;
		for( let i = 0; i < vLen; i++ ) { makeReadonly( v[ i ] ) }
		frozen = Object.isFrozen( v );
	}
	!frozen && Object.freeze( v );
	return v;
};

/**
 * Pulls propertyPath values from state and compiles them into a partial state object
 *
 * @param {T} source
 * @param {Array<string>} propertyPaths
 * @returns {{[K in keyof T]?:*}}
 * @template {{[x: string]:*}} T
 */
export function mapPathsToObject( source, propertyPaths ) {
	const paths = [];
	for( const path of propertyPaths ) {
		paths.push( path.replace( /\.?\[/g, '.' ).replace( /^\.|\]/g, '' ) );
	}
	const dest = {};
	let object = dest;
	for( const path of arrangePropertyPaths( paths ) ) {
		if( !has( source, path ) ) { continue }
		const value = get( source, path );
		for( let tokens = path.split( '.' ), tLen = tokens.length, t = 0; t < tLen; t++ ) {
			const token = tokens[ t ];
			if( t + 1 === tLen ) {
				object[ token ] = value;
				object = dest;
				break;
			}
			if( !( token in object ) ) {
				object[ token ] = {};
			}
			object = object[ token ];
		}
	}
	return dest;
}
