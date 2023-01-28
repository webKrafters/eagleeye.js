<p align="center">
	<img alt="Eagle Eye" height="150px" src="eagle-eye.png" width="250px" />
</p>
<p align="center">
	<a href="https://typescriptlang.org">
		<img alt="TypeScript" src="https://badgen.net/badge/icon/typescript?icon=typescript&label">
	</a>
	<a href="https://github.com/webKrafters/react-observable-context/actions">
		<img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/webKrafters/react-observable-context/test.yml">
	</a>
	<a href="https://coveralls.io/github/webKrafters/react-observable-context">
		<img alt="coverage" src="https://img.shields.io/coveralls/github/webKrafters/react-observable-context">
	</a>
	<img alt="NPM" src="https://img.shields.io/npm/l/@webkrafters/react-observable-context">
	<img alt="Maintenance" src="https://img.shields.io/maintenance/yes/2032">
	<img alt="build size" src="https://img.shields.io/bundlephobia/minzip/@webkrafters/react-observable-context?label=bundle%20size">
	<a href="https://www.npmjs.com/package/@webKrafters/react-observable-context">
		<img alt="Downloads" src="https://img.shields.io/npm/dt/@webkrafters/react-observable-context.svg">
	</a>
	<img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/webKrafters/react-observable-context">
</p>

# React-Observable-Context [Eagle Eye]

A context bearing an observable consumer [store](#store).\
Only re-renders subscribing components ([clients](#client)) on context state changes.\
Subscribing component decides which context state properties' changes to trigger its update.

**Name:** React-Observable-Context

**Moniker:** Eagle Eye

**Usage:** Please see [Usage](#usage) section

**Demo:** [Play with the app on codesandbox](https://codesandbox.io/s/github/webKrafters/react-observable-context-app)\
If sandbox fails to load app, please refresh dependencies on its lower left.

**Install:**\
npm i -S @webkrafters/react-observable-context\
npm install --save @webkrafters/react-observable-context

May also see <b><a href="#changes">What's Changed?</a></b> section below.

# Intro

A context bearing an observable consumer [store](#store). State changes within the store's internal state are only broadcasted to components subscribed to the store (the [clients](#client)). In this way, the `React-Observable-Context` prevents repeated automatic re-renderings of entire component trees resulting from ***context*** state changes.

# Concepts

## Client
A client is any component consuming the observable context. A client consumes the context either by using the <code>React-Observable-Context <a href="#usecontext">useContext</a></code> hook or by embedding itself within the connector returned by the <code>React-Observable-Context <a href="#connect">connect</a></code> function.

## Prehooks
 Prehooks provide a central place for sanitizing, modifying, transforming, validating etc. all related incoming state updates. The context store obtains its prehooks via its context [Provider's](#provider) `prehooks` optional prop.

 The context store **2** update operations each adhere to its own user-defined prehook when present. Otherwise, the update operation proceeds normally to completion. Thus, there are **2** prehooks named **resetState** and **setState** - after the store update methods they support.
 
 Each prehook returns a **boolean** value (`true` to continue AND `false` to abort the update operation). The prehook may modify (i.e. sanitize, transform, transpose) the argument to accurately reflect the intended update value. This is done by mutating part of the argument which holds the next `nextUpdate` values.
 <ol>
	<li>
		<p style="margin: 0 0 5px 10px">
			<b>resetState:</b> 
			<code style="margin: 10px 5px">(resetData: PartialState&lt;State&gt;, state: {current: State, original: State}) => boolean;</code> // <b><i><code>resetData</code></i></b> holds the <code>nextUpdate</code> values.
		</p>
	</li>
	<li>
		<p style="margin: 0 0 5px 10px">
			<b>setState:</b> 
			<code style="margin: 10px 5px">(newChanges: PartialState&lt;State&gt;) => boolean;</code> // <b><i><code>newChanges</code></i></b> holds the <code>nextUpdate</code> values.
		</p>
	</li>
 </ol>

***<u>Use case:</u>*** prehooks provide a central place for sanitizing, modifying, transforming, validating etc. all related incoming state updates.

<h2 id="property-path">Property path</h2>
A property path is a dot-notation string leading to a specific property within an object.<br />
<code>React-Observable-Context</code> recognizes any property path abiding by the <b><i><u>Lodash</u></i></b> property path specifications.<br />

<strong id="property-path-example">Ex. Given the following object:</strong>

```jsx
{ a: { c: { e: 5, f: [ 0, 2, 4 ] } } }
```
The property path `a.c.e` accesses the `e=5` property.<br />
Either of the property paths `a.c.f.1` and `a.c.f[1]`  accesses the `[1]=2` property.<br />
A special property path [@@STATE](#fullstate-selectorkey) may be used to access the full given object.<br />

<strong id="fullstate-selectorkey"><u>@@STATE</u></strong> is a special property path to access the full state object as a single slice.<br />
***Caution:*** :warning: When this property path exists in a <a href="#selector-map">selector map</a>, any change in the state object results in an update of its <a href="#store"><code>store.data</code></a> and a subsequent render of its client(s).

## Provider
The Provider component is a property of the `React-Observable-Context` context object. As a `React.context` based provider, it accepts the customary `children` and `value` props. It also accepts **2** optional props: <a href="#prehooks"><code>prehooks</code></a> and <a href="#storage"><code>storage</code></a>.

Routinely, the `value` prop is initialized with the full initial state. It may only be updated with parts of the state which are changing. Please see a [Provider Usage](#provider-usage) sample below. 

<h2 id="selector-map">Selector Map</h2>
A selector map is an object holding key:value pairs.<br />
<span style="margin-right: 10px">-</span><code>key</code> refers to an arbitrary name to be assigned to a given property in the <a href="#store"><code>store.data</code></a>.<br />
<span style="margin-right: 10px">-</span><code>value</code> refers to the <a href="#property-path">property path</a> leading to a state slice whose value will be assigned to and observed by this <a href="#store"><code>store.data</code></a> property.<br />
<span style="margin-right: 10px">-</span>A special '<a href="#fullstate-selectorkey">@@STATE</a>' value may be used to access and observe the full state object.<br />

<strong id="selector-map-example">Example:</strong>

```jsx
// Given the following state object:
const state = {
  a: 1, b: 2, c: 3, d: {
    e: 5,
    f: [ 6, {
      x: 7,
      y: 8,
      z: 9
   } ]
  }
};

// a client observing the following selector map
const selectorMap = {
  all: '@@STATE',
  myData: 'd',
  secondFElement: 'd.f[1]'
};

// will receive the following store data
store.data = {
  all: state,
  myData: state.d,
  secondFElement: state.d.f[1]
}
```

## Storage
The `React.Observable.Context` context allows for a user-defined Storage object to be provided for maintaining the integrity of the initial context state at a location of the user's choosing. This, it accepts, via its Provider's `storage` optional prop. The context defaults to `window.sessionstorage` in supporting environments. Otherwise, it defaults to its own internal memory-based storage.

A valid storage object is of the type: `IStorage<State>` implementing the following **4** methods:
<ol>
	<li><code style="margin-left: 10px">clone: (data: State) => State; // expects a state clone</code></li>
	<li><code style="margin-left: 10px">getItem: (key: string) => State;</code></li>
	<li><code style="margin-left: 10px">removeItem: (key: string) => void;</code></li>
	<li><code style="margin-left: 10px">setItem: (key: string, data: State) => void;</code></li>
</ol>

## Store
The `React.Observable.Context` context `store` is the client's portal into the context's underlying state. It exposes **3** properties namely:
<ol>
	<li>
		<p style="margin: 0 0 0 10px">
			<b>data:</b> 
			<span style="margin-left: 5px">
				which is an object holding resolved state slices as declared in the selector map. <a href="#selector-map-example">See selector map to store data example here</a>
			</span>
		</p>
	</li>
	<li>
		<p style="margin: 0 0 0 10px">
			<a href="#store-resetstate"><b>resetState:</b></a> 
			<code style="margin-left: 5px">(propertyPaths?: Array<string>) => void // resets slices of state referenced by the property paths to their initial values.</code>
		</p>
	</li>
	<li>
		<p style="margin: 0 0 0 10px">
			<a href="#store-setstate"><b>setState:</b></a> 
			<code style="margin-left: 5px">(changes: PartialState<State>) => void // merges only new/changed state slices.</code>
		</p>
	</li>
</ol>
<h3 id="store-resetstate"><code>store.resetState</code> Usage</h3>
<span style="margin: 5px 10px 0 0">-</span>Resets slices of state to their initial state values as desired.<br />
<span style="margin: 5px 10px 0 0">-</span>Accepts an array of property paths referencing the desired slices of state to reset.<br />
<span style="margin: 5px 10px 0 0">-</span>Performs a total state reset when <code>'@@STATE'</code> is present in the property paths array.<br />
<span style="margin: 5px 10px 0 0">-</span>Resets state slices referenced by the calling client's selector map when invoked with 0 arguments.<br />
<span style="margin: 5px 10px 0 16px">-</span>Performs a total state reset when <code>'@@STATE'</code> is present in the calling client's selector map.<br />
<span style="margin: 5px 10px 0 0">-</span>Performs no state reset when a client with no selector map invokes this method with 0 arguments.

<h3 id="store-setstate" style="margin-top:10px"><code>store.setState</code> Usage</h3>
:warning: <b><i>Do this:</i></b> <code>setState({stateKey0: changes0[, ...]});</code><br />
:warning: <b><i>Not this:</i></b> <code>setState({stateKey0: {...state.stateKey0, ...changes0}[, ...]});</code>
<h3 id="indexing"><b><i><u>Indexing</u></i></b></h3>
Existing array state property can be overridden with a new array.<br />
Use the indexed object to update array content at indexes.<br />
<strong>Example:</strong>

```jsx
// Given the following array bearing state object:
const state = { a: { b: [ { x: 7, y: 8, z: 9 } ] }, j: 10 };

// The following will override the existing array.
store.setState({ a: { b: [ { y: 30 }, 22 ] } });
// updates the state to: { a: { b: [ { y: 30 }, 22 ] }, j: 10 };

// The followinng will update the existing array at indexes.
store.setState({ a: { b: { 0: { y: 30 }, 1: 22 } } });
// updates the state to: { a: { b: [ { x: 7, y: 30, z: 9 }, 22 ] }, j: 10 };

// The previous statement is functionally equivalent to the following:
const [ first, second, ...rest ] = state.a.b;
store.setState({ ...state, a: { ...state.a, b: [ { ...first, y: 30 }, 22, ...rest ] } });
// Refrain from doing this, please!
```

<h3 id="setstate-tags"><b><i><u>Rewriting state using tag commands</u></i></b></h3>
By default <code>store.setState</code> merges new changes into current state. To overwrite current state slices with new state values, <b>7</b> tag commands have been provided for:
<ol>
	<li><span style="margin-left: 10px"><code>@@CLEAR:</code> setting state slice to its corresponding empty value</span></li>
	<li><span style="margin-left: 10px"><code>@@DELETE:</code> deleting properties</span></li>
	<li><span style="margin-left: 10px"><code>@@MOVE:</code> moving array elements</span></li>
	<li><span style="margin-left: 10px"><code>@@PUSH:</code> pushing new items into an array</span></li>
	<li><span style="margin-left: 10px"><code>@@REPLACE:</code> replacing property values</span></li>
	<li><span style="margin-left: 10px"><code>@@SET:</code> setting property values</span></li>
	<li><span style="margin-left: 10px"><code>@@SPLICE:</code> splicing array items</span></li>
</ol>
<b>Examples:</b><br /><br />

<i><b>@@CLEAR:</b> (takes no arguments)</i>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10
};

/* empties the state; sets state = {} */
store.setState( '@@CLEAR' ) // or store.setState({ '@@CLEAR': <anything> })

/* empties the value at state.a.b; sets state.a.b = [] */
store.setState({ a: { b: '@@CLEAR' } }) // or store.setState({ a: { b: { '@@CLEAR': <anything> } } })

/* empties the value at state.a.j; sets state.a.j = null */
store.setState({ a: { j: '@@CLEAR' } }) // or store.setState({ a: { j: { '@@CLEAR': <anything> } } })

/* empties the value at state.a.b[ 0 ]; sets state.a.b = [{}] */
store.setState({ a: { b: [ '@@CLEAR' ] } }) // or store.setState({ a: { b: [ { '@@CLEAR': <anything> } ] } })

/* empties the value at state.a.b[0]; sets state.a.b = [{}, state.a.b[1]] */
store.setState({ a: { b: [ '@@CLEAR', state.a.b[1] ] } }) // or store.setState({ a: { b: [ { '@@CLEAR': <anything> }, state.a.b[1] ] } })

/* empties the value at state.a.b[0]; sets state.a.b = [{}, a.b[1]] using indexing (RECOMMENDED) */
store.setState({ a: { b: { 0: '@@CLEAR' } } }) // or store.setState({ a: { b: { 0: { '@@CLEAR': <anything> } } } })
```

<i><b>@@DELETE:</b> (takes an array argument listing property keys to delete)</i>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10
};

store.setState({ '@@DELETE': [ 'a' ] }) // removes state.a; sets state = {j: 10}

store.setState({ a: { '@@DELETE': [ 'b' ] } }) // removes state.a.b; sets state.a = {}

/* removes state.a.b[0]; leaving state.a.b = [{ x: 17, y: 18, z: 19 }] */
store.setState({ a: { b: { '@@DELETE': [ 0 ] } } }) // or store.setState({ a: { b: { '@@DELETE': [ -2 ] } } })

/* removes `x` and `z` properties from state.a.b[1]; sets state.a.b = [{ x: 7, y: 8, z: 9 }, {y: 18}] */
store.setState({ a: { b: [ state.a.b[ 0 ], { '@@DELETE': [ 'x', 'z' ] } ] } })

/* removes `x` and `z` properties from state.a.b[1]; sets state.a.b = [{ x: 7, y: 8, z: 9 }, {y: 18}] using indexing (RECOMMENDED) */
store.setState({ a: { b: { 1: { '@@DELETE': [ 'x', 'z' ] } } } })
```

<i><b>@@MOVE:</b> (takes an array argument listing: -/+fromIndex, -/+toIndex and optional +numItems?. numItems = 1 by default)</i>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10,
  q: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
};

store.setState({ a: { '@@MOVE': [ 0, 1 ] } }) // assigning a '@@MOVE' command to a non-array property has no effect.

/* moves state.a.b[0] into index 1; leaving state.a.b = [{ x: 17, y: 18, z: 19 }, { x: 7, y: 8, z: 9 }] */
store.setState({ a: { b: { '@@MOVE': [ 0, 1 ] } } }) // or store.setState({ a: { b: { '@@MOVE': [ -2, -1 ] } } })

/* moves state.q[4] - [7] into indexes 1 - 4; leaving state.q = [ 1, 5, 6, 7, 8, 2, 3, 4, 9 ] */
store.setState({ a: { q: { '@@MOVE': [ 4, 1, 4 ] } } }) // or store.setState({ a: { q: { '@@MOVE': [ -5, -8, 4 ] } } })
```

<i><b>@@PUSH:</b> (takes an array argument listing new values to append)</i>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10
};

store.setState({ a: { '@@PUSH': [{ n: 5 }] } }) // assigning a '@@PUSH' command to a non-array property has no effect.

/* appends 2 new items into state.a.b; leaving state.a.b = [...state.a.b, { x: 27, y: 28, z: 29 }, { x: 37, y: 38, z: 39 }] */
store.setState({ a: { b: { '@@PUSH': [{ x: 27, y: 28, z: 29 }, { x: 37, y: 38, z: 39 }] } } })
```

<i><b>@@REPLACE:</b> (takes an argument holding the replacment value)</i>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10
};

store.setState({ '@@REPLACE': { a: 'Demo', j: 17 } }) // rewrites state to { a: 'Demo', j: 17 };

store.setState({ a: { '@@REPLACE': { message: 'Testing...' } } }) // rewrites state.a.b to { message: 'Testing...' }

/* rewrites state.a.b[1] to { x: 97, y: 98, z: 99 }; leaving state.a.b = [{ x: 7, y: 8, z: 9 }, { x: 97, y: 98, z: 99 }] */
store.setState({ a: { b: [ state.a.b[ 0 ], { '@@REPLACE': { x: 97, y: 98, z: 99 } } ] } })

/* rewrites state.a.b[1] to { x: 97, y: 98, z: 99 }; leaving state.a.b = [{ x: 7, y: 8, z: 9 }, { x: 97, y: 98, z: 99 }] using indexing (RECOMMENDED) */
store.setState({ a: { b: { 1: { '@@REPLACE': { x: 97, y: 98, z: 99 } } } } })
```

<i><b>@@SET:</b> (takes an argument holding either the replacment value or a compute function returning the replacement value)</i>

```jsx
/*
This tag is for handling edge cases only. Please use sparingly. In most cases, store.setState with or without any of the other tags is sufficient and most efficient.

This and the '@@REPLACE' tags are functionally equivalent when used with a replacement value argument.

Be aware that the compute function argument may be `undefined` for properties which do not yet exist in the state.
*/

const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10
};

store.setState({ '@@SET': currentValue => ({ ...currentValue, a: 'Demo', j: 17 }) }) // rewrites state to { ...state, a: 'Demo', j: 17 };

store.setState({ a: { '@@SET': currentValue => ({ ...currentValue, message: 'Testing...' }) } }) // rewrites state.a.b to { ...state, message: 'Testing...' }

/* rewrites state.a.b[1] to { x: 97, y: 98, z: 99 }; leaving state.a.b = [{ x: 7, y: 8, z: 9 }, { x: 97, y: 98, z: 99 }] */
store.setState({ a: { b: [ state.a.b[ 0 ], { '@@SET': currentValue => ({ ...currentValue, x: 97, y: 98, z: 99 }) } ] } })

/* rewrites state.a.b[1] to { x: 97, y: 98, z: 99 }; leaving state.a.b = [{ x: 7, y: 8, z: 9 }, { x: 97, y: 98, z: 99 }] using indexing (RECOMMENDED) */
store.setState({ a: { b: { 1: { '@@SET': currentValue => ({ ...currentValue, x: 97, y: 98, z: 99 }) } } } })
```

<i><b>@@SPLICE:</b> (takes an array argument listing: -/+fromIndex, +deleteCount and optional ...newItems? newItems = ...[] by default)</i>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10,
  q: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
};

store.setState({ a: { '@@SPLICE': [ 0, 1 ] } }) // assigning a '@@SPLICE' command to a non-array property has no effect.

/* removes state.a.b[0]; leaving state.a.b = [{ x: 17, y: 18, z: 19 }] */
store.setState({ a: { b: { '@@SPLICE': [ 0, 1 ] } } }) // or store.setState({ a: { b: { '@@SPLICE': [ -2, -1 ] } } })

/* replaces state.q[4] - [7] with 2 items; leaving state.q = [ 1, 2, 3, 4, 33, 88, 9 ] */
store.setState({ a: { q: { '@@SPLICE': [ 4, 4, 33, 88 ] } } }) // or store.setState({ a: { q: { '@@SPLICE': [ -5, 4, 33, 88 ] } } })
```

<h3><b><i>Combination Usage:</i></b></h3>

These tags may be used in combination with the default usage where all top-level tag command results in property are sequentially merged into state followed by the merging of the rest of the property changes.

<strong>Example:</strong>

```jsx
const state = {
  a: { b: [{ x: 7, y: 8, z: 9 }, { x: 17, y: 18, z: 19 }] },
  j: 10,
  q: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
};

store.setState({
  a: {
    b: {
      /* evaluated 1st */ '@@DELETE': [ 0 ], // upon deleting state.a.b[0] -> state.a.b[1] becomes the new state.a.b[0]
      /* evaluated 3rd */ 0: '@@CLEAR', // clear the new state.a.b[0]
      /* evaluated 4th */ 2: { x: 47, y: 48, z: 49 }, // add new item at state.a.b[2],
      /* evaluated 2md */ '@@PUSH': [{ x: 107, y: 108, z: 109 }] // appends state.a.b[1]
    }
  },
  j: { '@@SET': currentValue => currentValue < 10 ? currentValue : 0 },
  q: {
    /* evaluated 1st */ '@@MOVE': [ 5, 3, 2 ],
    /* evaluated 2md */ 12: 11
  }
})
// => {
//  a: { b: [{}, { x: 107, y: 108, z: 109 }, { x: 47, y: 48, z: 49 }] },
//  j: 0,
//  q: [ 1, 2, 3, 6, 7, 4, 5, 8, 9, <empty>, <empty>, <empty>, 11 ]
// }
```

# API

The React-Observable-Context module contains **4** exports namely:
<ol>
	<li style="padding-bottom: 5px">
		<p style="margin: 0 0 5px 5px">
			<b id="connect">connect</b>
			<p style="margin: -5px 0 0 5px">
				<span style="margin: 5px 10px 0 0">-</span>is a function taking a <code>React-Observable-Context</code> context object and an optional <a href="#selector-map">selector map</a> parameters; and returning a reusable connector function.<br />
				<span style="margin: 5px 10px 0 0">-</span>The connector function takes a client as a parameter and returns an HOC.<br />
				<span style="margin: 5px 10px 0 0">-</span>Any client using similar context object and selector map may be passed to this connector.<br />
				<span style="margin: 5px 10px 0 0">-</span>The HOC injects the context <a href="#store">store</a> to the client and handles all of the context usage requirements.<br />
				<span style="margin: 5px 10px 0 0">-</span>The injected <a href="#store">store</a> monitors changes in the underlying state slices referenced by the selector map.<br />
				<span style="margin: 5px 10px 0 0">-</span>A change in any of the referenced state slices automatically triggers an update of the related <code>store.data</code> property and a subsequent render of the client.<br />
				<span style="margin: 5px 10px 0 0">-</span>Any prop name conflicts between injected <a href="#store">store properties</a> and the client's own props are resolved in favor of the client's own props.
			</p>
		</p>
	</li>
	<li style="padding-bottom: 5px">
		<p style="margin: 0 0 5px 5px">
			<b>createContext</b> is a zero-parameter function returning a <code>React-Observable-Context</code> object. This object is the store-bearing context. To access the context's <a href="#store">store</a>, pass the context as a <code>context</code> parameter to either the <a href="#connect">connect</a> function or the <a href="#usecontext">useContext</a> hook.
		</p>
	</li>
	<li style="padding-bottom: 5px">
		<p style="margin: 0 0 5px 5px">
			<b>UsageError</b> class is the Error type reported for attempts to access this context's store outside of its Provider component tree.
		</p>
	</li>
	<li>
		<p style="margin: 0 0 5px 5px">
			<b id="usecontext">useContext</b>
			<p style="margin: -5px 0 0 5px">
				<span style="margin: 5px 10px 0 0">-</span>is a hook taking a <code>React-Observable-Context</code> context object and an optional <a href="#selector-map">selector map</a> parameters; and returning the context <a href="#store">store</a>.<br />
				<span style="margin: 5px 10px 0 0">-</span>The injected <a href="#store">store</a> monitors changes in the underlying state slices referenced by the selector map.<br />
				<span style="margin: 5px 10px 0 0">-</span>A change in any of the referenced state slices automatically triggers an update of the related <code>store.data</code> property and a subsequent render of the client.<br />
				<span style="margin: 5px 10px 0 0">-</span>The <a href="#connect">connect</a> function is axiomatically the more conducive method for consuming this conetxt.<br />
				<span style="margin: 5px 10px 0 0">-</span>In certain user-specific cases, direct access to this hook may be preferrable.<br />
				<span style="margin: 5px 10px 0 0">-</span>In such cases, it is advisable to wrap the client in a <code>React.memo</code>.
			</p>
		</p>
	</li>
</ol>

# Usage

<i><u><b>context.js</b></u></i>

```jsx
import { createContext } from '@webkrafters/react-observable-context';
export default createContext();
```

<i><u><b>ui.js</b></u> (connect method)</i>

```jsx
import React, { useCallback, useEffect } from 'react';
import { connect } from '@webkrafters/react-observable-context';
import ObservableContext from './context';

export const YearText = ({ data }) => ( <div>Year: { data.year }</div> );
export const YearInput = ({ data, setState, resetState }) => {
  const onChange = useCallback( e => setState({
    a: { b: { x: { y: { z: { 0: e.target.value } } } } }
  }), [ setState ]);
  useEffect(() => {
    data.year > 2049 && resetState([ 'a.b.c' ]);
  }, [ data.year ]);
  return ( <div>Year: <input type="number" onChange={ onChange } /> );
};

const withConnector = connect( ObservablContext, { year: 'a.b.x.y.z[0]' } );
const Client1 = withConnector( YearText );
const Client2 = withConnector( YearInput );

const Ui = () => (
  <div>
    <Client1 />
    <Client2 />
  </div>
);

export default Ui;
```

<i><u><b>ui.js</b></u> (useContext with memo method)</i>

```jsx
import React, { memo, useCallback, useEffect } from 'react';
import { useContext } from '@webkrafters/react-observable-context';
import ObservableContext from './context';

const selectorMap = { year: 'a.b.x.y.z[0]' };

const Client1 = memo(() => { // memoize to prevent 'no-change' renders from the parent.
  const { data } = useContext( ObservableContext, selectorMap );
  return ( <div>Year: { data.year }</div> );
});

const Client2 = memo(() => { // memoize to prevent 'no-change' renders from the parent.
  const { data, setState, resetState } = useContext( ObservableContext, selectorMap );
  const onChange = useCallback( e => setState({
    a: { b: { x: { y: { z: { 0: e.target.value } } } } }
  }), [ setState ]);
  useEffect(() => {
    data.year > 2049 && resetState([ 'a.b.c' ]);
  }, [ data.year ]);
  return ( <div>Year: <input type="number" onChange={ onChange } /> );
});

const Ui = () => (
  <div>
    <Client1 />
    <Client2 />
  </div>
);

export default Ui;
```

<i id="provider-usage"><b><u>provider.js</u></b></i>

```jsx
import React, { useEffect, useState } from 'react';
import ObservableContext from './context';
import Ui from './ui';

const DEFAULT_C = 36;

const updateHooks = {
  resetState: ( ...args ) => {
    console.log( 'resetting state with >>>> ', JSON.stringify( args ) );
    return true;
  },
  setState: ( ...args ) => {
    console.log( 'merging following into state >>>> ', JSON.stringify( args ) );
    return true;
  }
};

const storageStub = {
  clone( data ) { return your_clone_function( data ) }, 
  data: null,
  getItem( key ) { return this.data },
  removeItem( key ) { this.data = null },
  setItem( key, data ) { this.data = data } 
};

const Provider = ({ c = DEFAULT_C }) => {
	
  const [ state, setState ] = useState(() => ({
    a: { b: { c, x: { y: { z: [ 2022 ] } } } }
  }));

  useEffect(() => {
    // similar to `store.setState`, use the following to update
    // only the changed slice of the context internal state.
    setState({ a: { b: { c } } });
    // Do not do the following: it will override the context internal state.
    // setState({ ...state, a: { ...state.a, b: { ...state.a.b, c } } });
  }, [ c ]);

  return (
    <ObservableContext.Provider
      prehooks={ updateHooks }
      storage={ storageStub }
      value={ state }
    >
      <Ui />
    </ObservableContext.Provider>
  );
};
Provider.displayName = 'Provider';

export default Provider;
```

<i><b><u>index.js</u></b></i>

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import Provider from './provider';

ReactDOM.render( <Provider />, document.getElementById( 'root' ) );
```

<h1 id="changes">What's Changed?</h1>
<b>v4.1.0</b>
<table>
	<tbody>
		<tr><td><b>1.</b></td><td>Added new setState <a href="#setstate-tags">tags</a> to facilitate state update operations.</td></tr>
	</tbody>
</table>
<hr />

<b>v4.0.0</b>
<table>
	<tbody>
		<tr><td><b>1.</b></td><td>Added the <a href="#connect"><code>connect</code></a> function to facilitate the encapsulated context-usage method.</td></tr>
		<tr><td><b>2.</b></td><td>Added stronger support for deeply nested state structure. See <a href="#store-setstate"><code>store.setState</code></a></td></tr>
		<tr><td><b>3.</b></td><td>Replaced the <a href="#usecontext"><code>useContext</code></a> watchedKeys array parameter with a <a href="#selector-map"><code>selectorMap</code></a> object.</td></tr>
		<tr><td><b>4.</b></td><td>Removed the necessity for direct store subscription.</td></tr>
		<tr><td><b>5.</b></td><td><a href="#store-resetstate"><code>store.resetState</code></a> can now take a <a href="#property-path">property path</a> array targeting which state slices to reset.</td></tr>
		<tr><td><b>6.</b></td><td>Context provider accepts an optional <a href="#storage">storage</a> prop for memorizing initial state.</td></tr>
		<tr><td><b>7.</b></td><td>Removed the need for <code>store.getState</code>. <code>store.data</code> now holds the state slices used at the client. Changes in any of the slices held by the <code>store.data</code> are automatically updated as they occur. The client is immediately notified of the update.</td></tr>
	</tbody>
</table>


# License

MIT
