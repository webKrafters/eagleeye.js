﻿# React-Observable-Context

A context bearing an observable consumer store. State changes within the store's internal state are only broadcasted to components subscribed to the store. In this way, the `React-Observable-Context` prevents repeated automatic re-renderings of entire component trees resulting from ***context*** state changes.

**React::memo** *(and PureComponents)* remain the go-to solution for the repeated automatic re-renderings of entire component trees resulting from ***component*** state changes. 

_**Recommendation:**_ Wrap all components calling this package's ***useContext*** function in **React::memo**. This will protect such component and its descendants from unrelated cascading render operations. 

<h4><u>Install</u></h4>

npm i -S @webkrafters/react-observable-context

npm install --save @webkrafters/react-observable-context

## API

The React-Observable-Context package exports **3** modules namely: the **createContext** method, the **useContext** hook and the **Provider** component.

* **createContext** is a zero-parameter funtion returning a store-bearing context. Pass the context to the React::useContext() parameter to obtain the context's `store`.

* **useContext** is analogous to React::useContext hook but returns the context store and takes a second parameter named ***watchedKeys***. The `watchedKeys` parameter is a list of state object property paths to watch. A change in any of the referenced properties automatically triggers a render of the component calling this hook.

* **Provider** can immediately be used as-is anywhere the React-Observable-Context is required. It accepts **3** props and the customary Provider `children` prop. Supply the context to its `context` prop; the initial state to the customary Provider `value` prop; and the optional `prehooks` prop <i>(discussed in the prehooks section below)</i>.

***<u>Note:</u>*** the Provider `context` prop is not updateable. Once set, all further updates to this prop are not recorded.

### The Store

The context's `store` exposes **4** methods for interacting with the context's internal state namely:

* **getState**: (selector?: (state: State) => any) => any

* **resetState**: VoidFunction // resets the state to the Provider initial `value` prop.

* **setState**: (changes: PartialState\<State\>) => void // sets only new/changed top level properties.

* **subscribe**: (listener: (newValue: PartialState\<State\>, oldValue: PartialState\<State\>) => void) => ***UnsubscribeFunction***

### Prehooks

The context's store update operation adheres to **2** user supplied prehooks when present. Otherwise, the update operation proceeds normally to completion. They are named **resetState** and **setState** after the store update methods which utilize them.

* **resetState**: (state: {current: State, original: State}) => boolean

* **setState**: (newChanges: PartialState\<State\>) => boolean

***<u>Use case:</u>*** prehooks provide a central place for sanitizing, modifying, transforming, validating etc. all related incoming state updates. The prehook returns a **boolean** value (`true` to continue AND `false` to abort the update operation). The prehook may mutate (i.e. sanitize, transform, transpose) its argument values to accurately reflect the intended update value.

## Usage

<i><u>context.js</u></i>

    import { createContext } from '@webkrafters/react-observable-context';
	const ObservableContext = createContext();
    export default ObservableContext;

<i><u>reset.js</u></i>

    import React, { memo, useEffect } from 'react';
	import { useContext } from '@webkrafters/react-observable-context';
	import ObservableContext from './context';
	const Reset = memo(() => {
		const { resetState } = useContext( ObservableContext );
		useEffect(() => console.log( 'Reset component rendered.....' ));
		return ( <button onClick={ resetState }>reset context</button> );
	});
	Reset.displayName = 'Reset';
    export default Reset;

<i><u>tally-display.js</u></i>

    import React, { memo, useEffect } from 'react';
	import { useContext } from '@webkrafters/react-observable-context';
	import ObservableContext from './context';
	import Reset from './reset';
    const CONTEXT_KEYS = [ 'color', 'price', 'type' ];
    const TallyDisplay = memo(() => {
	    const { getState } = useContext( ObservableContext, CONTEXT_KEYS );
	    useEffect(() => console.log( 'TallyDisplay component rendered.....' ));
	    return (
			<div>
				<table>
					<tbody>
						<tr><td><label>Type:</label></td><td>{ getState( s => s.type ) }</td></tr>
						<tr><td><label>Color:</label></td><td>{ getState( s => s.color ) }</td></tr>
						<tr><td><label>Price:</label></td><td>{ getState( s => s.price ).toFixed( 2 ) }</td></tr>
					</tbody>
				</table>
				<div style={{ textAlign: 'right' }}>
					<Reset />
				</div>
			</div>
		);
    });
    TallyDisplay.displayName = 'TallyDisplay';
    export default TallyDisplay;

<i><u>editor.js</u></i>

    import React, { memo, useCallback, useEffect, useRef } from 'react';
	import { useContext } from '@webkrafters/react-observable-context';
	import ObservableContext from './context';
    const Editor = memo(() => {
	    const { setState } = useContext( ObservableContext );
	    const priceInputRef = useRef();
	    const colorInputRef = useRef();
	    const typeInputRef = useRef();
	    const updatePrice = useCallback(() => {
		    setState({ price: Number( priceInputRef.current.value ) });
	    }, []);
	    const updateColor = useCallback(() => {
		    setState({ color: colorInputRef.current.value });
	    }, []);
	    const updateType = useCallback(() => {
		    setState({ type: typeInputRef.current.value });
	    }, []);
	    useEffect(() => console.log( 'Editor component rendered.....' ));
	    return (
		    <fieldset style={{ margin: '10px 0' }}>
			    <legend>Editor</legend>
			    <div style={{ margin: '10px 0' }}>
				    <label>New Price: <input ref={ priceInputRef } /></label>
				    { ' ' }
				    <button onClick={ updatePrice }>update price</button>
			    </div>
			    <div style={{ margin: '10px 0' }}>
				    <label>New Color: <input ref={ colorInputRef } /></label>
				    { ' ' }
				    <button onClick={ updateColor }>update color</button>
			    </div>
			    <div style={{ margin: '10px 0' }}>
				    <label>New Type: <input ref={ typeInputRef } /></label>
				    { ' ' }
				    <button onClick={ updateType }>update type</button>
			    </div>
		    </fieldset>
	    );
	});
    Editor.displayName = 'Editor';
    export default Editor;

<i><u>product-description.js</u></i>

    import React, { memo, useEffect } from 'react';
	import { useContext } from '@webkrafters/react-observable-context';
	import ObservableContext from './context';
	const CONTEXT_KEYS = [ 'color', 'type' ];
    const ProductDescription = memo(() => {
	    const store = useContext( ObservableContext, CONTEXT_KEYS );
	    useEffect(() => console.log( 'ProductDescription component rendered.....' ));
	    const color = store.getState( s => s.color );
	    const type = store.getState( s => s.type );
	    return (
		    <div style={{ fontSize: 24 }}>
			    <strong>Description:</strong> { color } { type }
		    </div>
	    );
    });
    ProductDescription.displayName = 'ProductDescription';
    export default ProductDescription;

<i><u>price-sticker.js</u></i>

    import React, { memo, useEffect } from 'react';
	import { useContext } from '@webkrafters/react-observable-context';
	import ObservableContext from './context';
	const CONTEXT_KEYS  = [ 'price' ];
    const PriceSticker = memo(() => {
	    const { getState } = useContext( ObservableContext, CONTEXT_KEYS );
	    useEffect(() => console.log( 'PriceSticker component rendered.....' ));
	    return (
		    <div style={{ fontSize: 36, fontWeight: 800 }}>
			    ${ getState( s => s.price ).toFixed( 2 ) }
		    </div>
	    );
    });
    PriceSticker.displayName = 'PriceSticker';
    export default PriceSticker;

<i><u>product.js</u></i>

    import React, { useCallback, useEffect, useState } from 'react';
    import { Provider } from '@webkrafters/react-observable-context';
	import ObservableContext from './context';
    import Editor from './editor';
    import PriceSticker from './price-sticker';
    import ProductDescription from './product-description';
    import TallyDisplay from './tally-display';
    const Product = ({ prehooks = undefined, type }) => {
	    const [ state, setState ] = useState(() => ({
		    color: 'Burgundy',
		    price: 22.5,
		    type
	    }));
	    useEffect(() => {
		    setState({ type }); // use this to update only the changed state
		    // setState({ ...state, type }); // this will reset the context internal state
	    }, [ type ]);
	    const overridePricing = useCallback( e => setState({ price: Number( e.target.value ) }), [] );
	    return (
		    <div>
			    <div style={{ marginBottom: 10 }}>
				    <label>$ <input onKeyUp={ overridePricing } placeholder="override price here..."/></label>
			    </div>
				<Provider
					context={ ObservableContext }
					prehooks={ prehooks }
					value={ state }
				>
				    <div style={{
					    borderBottom: '1px solid #333',
					    marginBottom: 10,
					    paddingBottom: 5
				    }}>
					    <Editor />
					    <TallyDisplay />
				    </div>
				    <ProductDescription />
				    <PriceSticker />
			    </Provider>
		    </div>
	    );
    };
    Product.displayName = 'Product';
    export default Product;

<i><u>app.js</u></i>

    import React, { useCallback, useMemo, useState } from 'react';
    import Product from './product';
	const prehooks = {
		resetState: ( ...args ) => {
			console.log( 'resetting state with >>>> ', JSON.stringify( args ) );
			return true;
		},
		setState: ( ...args ) => {
			console.log( 'setting state with >>>> ', JSON.stringify( args ) );
			return true;
		}
	};
    const App = () => {
	    const [ productType, setProductType ] = useState( 'Calculator' );
	    const updateType = useCallback( e => setProductType( e.target.value ), [] );
	    return (
		    <div className="App">
			    <h1>Demo</h1>
			    <h2>A contrived product app.</h2>
			    <div style={{ marginBottom: 10 }}>
				    <label>Type: <input onKeyUp={ updateType } placeholder="override product type here..." /></label>
			    </div>
			    <Product prehooks={ prehooks } type={ productType } />
		    </div>
	    );
    };
    App.displayName = 'App';
    export default App;

<i><u>index.js</i></b>

    import React from 'react';
    import ReactDOM from 'react-dom';
    import App from './app';
    ReactDOM.render(<App />, document.getElementById('root'));

## License

MIT
