import { Link } from '@remix-run/react';

const Header : React.FC<{children: React.ReactNode, id?: string}> = ({ children, ...props }) => (
    <header
        { ...props }
        style={{
            display: 'inline-block',
            fontStyle: 'italic',
            fontWeight: 500,
            textDecoration: 'underline'
        }}
    >
        { children }
    </header>
);

export default function GettingStarted() {
    return (
        <article className="getting-started">
            <h1>Getting Started</h1>
            <div className="snippet-intro">
                Eagle Eye context and the React.Context API share a similar setup flow. Let us begin by installing the Eagle Eye context package.
            </div>
            <div className="snippet-box">
                <pre>
                    { `npm install @webkrafters/react-observable-context` }
                </pre>
            </div>
            <div className="snippet-intro" id="create-context-usage">
                <h3>Creating the context store</h3>
                To obtain a fresh context store, just call the parameterless <pre>{ `createContext()` }</pre> function. 
            </div>
            <div className="snippet-box">
                <Header>context.js</Header>
                <pre>
                    { `
                    import { createContext } from '@webkrafters/react-observable-context';
                    export default createContext();
                    ` }
                </pre>
            </div>
            <div className="snippet-intro" id="provider-usage">
                <h3>Providing the context store</h3>
                Similar to the React.Context API, you can make the context store available to any section of the component tree by wrapping it in the context store's Provider.
                <div>Further readings on the Eagle Eye Context Provider could be found <Link to="/concepts/provider">here</Link>.</div>
            </div>
            <div className="snippet-box">
                <Header>provider-demo.js</Header>
                <pre>
                    { `
                    import React, { useEffect, useState } from 'react';
                    import ObservableContext from './context';
                    import Ui from './ui';

                    const createInitialState = c = ({
                        a: { b: { c, x: { y: { z: [ 2022 ] } } } }
                    });

                    const ProviderDemo = ({ ageInMinutes: c = 0 }) => {
                        
                        const [ value, setValue ] = useState(() => createInitialState( c ));

                        useEffect(() => {
                            // similar to  \`store.setState\`, use the following to update
                            // only the changed slice of the context internal state.
                            // Please use the \`Set State\` link in the TOC for more details.
                            setValue({ a: { b: { c } } }); // OR
                            // setValue({ a: { b: { c: { '@@REPLACE': c } } } });
                            // Do not do the following: it will override the context internal state.
                            // setValue({ ...value, a: { ...value.a, b: { ...value.a.b, c } } });
                        }, [ c ]);

                        return (
                            <ObservableContext.Provider value={ value }>
                            <Ui />
                            </ObservableContext.Provider>
                        );
                    };
                    ProviderDemo.displayName = 'ProviderDemo';

                    export default ProviderDemo;
                    ` }
                </pre>
            </div>
            <div className="snippet-intro" id="connect-usage">
                <h3>Consuming the context store</h3>
                <p>There are two ways of consuming the Eagle Eye context store: The HOC method and the React Hook method.</p>
                <p>
                    Let's tackle the HOC method first. This method uses the <pre>{ `connect()` }</pre> HOC function to wire up 
                    the context store to your consumer component. It embodies the "set-it-and-forget-it" paradigm. Just set up 
                    a list of property paths to state slices to observe { '(' }see <Link to="/concepts/selector-map">Selector Map</Link>{ ')' }. 
                    Context takes care of the rest.
                </p>
                <p>The following is a sample of the HOC consumer method.</p>
            </div>
            <div className="snippet-box">
                <Header>ui.js</Header>
                <pre>
                    { `
                    import React, { useCallback, useEffect } from 'react';
                    import { connect } from '@webkrafters/react-observable-context';
                    import ObservableContext from './context';

                    export const YearText = ({ data }) => ( <div>Year: { data.year }</div> );

                    export const YearInput = ({ data, resetState, setState }) => {
                    const onChange = useCallback( e => setState({
                        a: { b: { x: { y: { z: { 0: e.target.value } } } } }
                    }), [ setState ]);

                    useEffect(() => {
                        data.year > 2049 && resetState([ 'a.b.c' ]);
                    }, [ data.year ]);
                    
                    return ( <div>Year: <input type="number" onChange={ onChange } /></div> );
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
                    ` }
                </pre>
            </div>
            <div className="snippet-intro" id="usecontext-usage">
                <h3>Consuming the context store (React Hook method)</h3>
                <p>
                    The following shows how to consume the Eagle Eye context store through the hook method. This method uses 
                    the <pre>{ `useContext()` }</pre> function to expose the store to the consumer component. In addition to 
                    setting up a map of property paths to state slices to observe { '(' }see <Link to="/concepts/selector-map">Selector Map</Link>{ ')' }, 
                    the consumer compoent may have to be wrapped in a <pre>{ `React.memo()` }</pre> HOC to shield from 
                    cascading rerenders from parent/anscestor components.
                </p>
            </div>
            <div className="snippet-box">
                <Header>ui.js</Header>
                <pre>
                    { `
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

                    return ( <div>Year: <input type="number" onChange={ onChange } /></div> );
                    });

                    const Ui = () => (
                        <div>
                            <Client1 />
                            <Client2 />
                        </div>
                    );

                    export default Ui;
                    ` }
                </pre>
            </div>
            <div className="snippet-intro">
                Wiring up your Eagle Eye context to the rest of the application is identical to the React.Context API. The following is a contrived snippet to demonstrate.
            </div>
            <div className="snippet-box">
                <Header>app.js</Header>
                <pre>
                    { `
                    import React, { useEffect, useState } from 'react';
                    import ProviderDemo from './provider-demo';
        
                    const MILLIS_PER_MINUTE = 6e4;
        
                    let numCreated = 0;
        
                    const App = () => {
                        const [ age, updateAge ] = useState( 0 );
                        const [ testNumber ] = useState( () => ++numCreated );
        
                        useEffect(() => {
                            const t = setTimeout(
                                () => updateAge( age => age + 1 ),
                                MILLIS_PER_MINUTE
                            ); 
                            return () => clearTimeout( t );
                        }, [ age ]);
            
                        return (
                            <div>
                                <h2>App instance #: { testNumber }</H2>
                                <ProviderDemo ageInMinutes={ age } />
                            </div>
                        );
                    }
                    export default App;
                    ` }
                </pre>
            </div>
        </article>
    );
}