<p align="center">
	<img alt="Eagle Eye" height="150px" src="logo.png" width="250px" />
</p>
<p align="center">
	<a href="https://typescriptlang.org">
		<img alt="TypeScript" src="https://badgen.net/badge/icon/typescript?icon=typescript&label">
	</a>
	<a href="https://github.com/webKrafters/eagleeye.js/actions">
		<img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/webKrafters/eagleeye.js/test.yml">
	</a>
	<a href="https://coveralls.io/github/webKrafters/eagleeye.js">
		<img alt="coverage" src="https://img.shields.io/coveralls/github/webKrafters/eagleeye.js">
	</a>
	<img alt="NPM" src="https://img.shields.io/npm/l/@webkrafters/eagleeye.js">
	<img alt="Maintenance" src="https://img.shields.io/maintenance/yes/2032">
	<img alt="build size" src="https://img.shields.io/bundlephobia/minzip/@webkrafters/eagleeye.js?label=bundle%20size">
	<a href="https://www.npmjs.com/package/@webKrafters/eagleeye.js">
		<img alt="Downloads" src="https://img.shields.io/npm/dt/@webkrafters/eagleeye.js.svg">
	</a>
	<img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/webKrafters/eagleeye.js">
</p>

# Eagle Eye.

<p>Framework-agnostic native-javasacript change-stream capable immutable state manager.</p>
<p>It is not logically bound to any section of an application. A single instance may be deployed anywhere within an application as needed.</p>
<p>It is also not bound by quantity. As many instances as needed may be created and deployed simultaneously anywhere within an application.</p>

<br />
<p><b>Name:</b> Eagle Eye.</p>
<p>
<b>Install:</b>
npm install --save @webkrafters/eagleeye
</p>
<br />

## Usage:
### Create (the FP way).
```tsx
import { createEagleEye } from '@webkrafters/eagleeye';
const context = createEagleEye({
	prehooks?: Prehooks<T>,
	storage?: Storage<T>,
	value?: T|AutoImmutable<T>
});
```
### Create (the OOP way).
```tsx
import { EagleEyeContext } from '@webkrafters/eagleeye';
const context = new EagleEyeContext<T>(
	T?|AutoImmutable<T>?,
	Prehooks<T>?,
	Storage<T>?
);
```

### Releasing context resources.
```tsx
context.dispose();
```
Deactivates this context by:
<ol>
	<li>unsubscribing all observers to it</li>
	<li>severing connections to data stores</li>
	<li>unsetting all resources</li>
</ol>

### Accessing external store reference.
```tsx
const store = context.store;
// https://eagleeye.js.org/concepts/store/resetstate/
store.resetState( Array<string>? );
// https://eagleeye.js.org/concepts/store/setstate/
store.setState( Changes<T> );
// https://eagleeye.js.org/concepts/store/getstate/
const state = store.getState( Array<string> );
// https://eagleeye.js.org/concepts/store/subscribe/
const unsubscribeFn = store.subscribe( eventType, listener );
```

### Joining the context stream.
A context stream allows a client to set up a dedicated channel through which it receives automatic updates whenever its selected slices of state change. It can also update the context through this channel.
```tsx
const useStream = context.stream;
// joining the stream twice
// for more on selectorMap - https://eagleeye.js.org/concepts/selector-map/
const channel1 = useStream(SelectorMap?);
const channel2 = useStream(SelectorMap?);
// check whether a channel still defunct or still active
if( channel1.closed ) { ... };
// access the current data value monitored by this channel
console.log( 'data', channel1.data );
// access the channel current lifecycle
console.log( 'life cycle', channel1.phase );
// check if the channel is streaming
if( channel1.streaming ) { ... };
// change a channel's selector map 
channel1.seletorMap = SelectorMap<T>?;
// add listener to a channel to react to live updates to selected data.
channel1.addListener( 'data-changed', listener );
// be notified of a channel's exit from stream.
channel1.addListener( 'stream-ending', listener );
// remove listener from a channel activities
channel1.removeListener( 'data-changed'|'stream-ending', listener );
// https://eagleeye.js.org/concepts/store/resetstate/
channel1.resetState( Array<string>? ); // changes are context-wide
// https://eagleeye.js.org/concepts/store/setstate/
channel1.setState( Changes<T> ); // changes are context-wide
// exit channel from stream
channel1.endStream();
```

### Accessing underlying cache.
```tsx
const cache = context.cache;
```

### Accessing `close` status.
```tsx
const closed = context.closed;
```

### Accessing current state update `prehooks`.
```tsx
const prehooks = context.prehooks;
```

### Updating state update `prehooks`.
```tsx
context.prehooks = Prehooks<T>?;
```

### Accessing context `storage`.
```tsx
const storage = context.storage;
```

### Updating context `storage`.
```tsx
context.storage = storage<T>?;
```

## Notable Mentions:
<ul>
	<li>Facilitates sharing of underlying immutable data structure among multiple applications</li>
	<li>Update-friendly Auto-immutable bearing context. See <a href="https://eagleeye.js.org/concepts/store/setstate"><code>store.setState</code></a>.</li>
	<li> Recognizes <b>negative array indexing</b>. Please see <a href="https://eagleeye.js.org/concepts/property-path">Property Path</a> and <code>store.setState</code> <a href="https://eagleeye.js.org/concepts/store/setstate#indexing">Indexing</a>.</li>
	<li> Only automatically notifying subscribing or stream (<a href="https://eagleeye.js.org/concepts/client">clients</a>) on context state changes.</li>
	<li> Subscribers decide which exact context state properties' changes to monitor.</li>
</ul>

## Please see more documentation here:
**[eagleeye.js.org](https://eagleeye.js.org)**

# License

GPLv3
