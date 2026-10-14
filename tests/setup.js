// The browser modules in src/ expect window and matchMedia. Give them minimal stand-ins in Node.
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
