/* eslint-env node, jest */
const React = require("react");
const Babel = require("@babel/standalone");
Babel.registerPlugin("loopProtection", require("../lib")(100));
Babel.registerPreset(
  "React",
  require("../node_modules/@babel/preset-react/lib")
);
const assert = (e) => console.assert(e);

const code = {
  simple: 'return "remy";',
  simpleclass:
    "(()=>{class Test extends React.Component {\n constructor(props) { super(props); this.a = 1; }\n render() { var a = this.a;\n return(<div>{a}</div>);\n}\n}\n return new Test().a;})()",
  simplefunctionalclass:
    "(() => {const TestClass = () => { return(<div>Some Value</div>); }; return TestClass();})();",
  notclass:
    '(() => {\n  console.log("class");\n  console.log("while");\n  console.log(" foo do bar ");\n  console.log(" foo while bar ");\n  return true;\n})();',
  notprops:
    'var foo = { "class": "bar" }; if (foo["class"] && foo.do) {}\nreturn true;',
  infiniteclass:
    "(()=>{class TestClass {\n constructor() {\n this.a = 1;\n }\n render() {\n return(\n <div><TestClass /></div>\n);\n }\n} new TestClass(); return true;})()",
  infinitefuncclass:
    "(()=>{const FuncClass = () => { return(<div>Some content with<FuncClass /></div>); }; return FuncClass();})()",
};

const sinon = {
  spy: (fn) => jest.fn(fn),
};

var spy;

const loopProtect = (code) =>
  Babel.transform(code, {
    plugins: ["loopProtection"],
    presets: ["React"],
  }).code; // eslint-disable-line no-new-func
const run = (code) => eval(`${code}`); // eslint-disable-line no-eval

describe("recursion", function () {
  beforeEach(function () {
    spy = sinon.spy(run);
  });

  it("should handle class components", () => {
    const code = `(()=>{
          class ShoppingCart extends React.Component {
            constructor(props) {
                super(props);
            }
            render() {
              { /* Change code below this line */ }
              return (<div>Testing all</div>)
              { /* Change code above this line */ }
            }
          };
          let a = new ShoppingCart();
          return a;
        })()`;

    const compiled = loopProtect(code);
    expect(compiled).not.toBe(code);
  });

  it("should rewrite class components", function () {
    var c = code.simpleclass;
    var compiled = loopProtect(c);
    expect(compiled).not.toBe(c);
    var result = run(compiled);
    expect(result).toBe(1);
  });

  it("should protect infinite class components", function () {
    var c = code.infiniteclass;
    var compiled = loopProtect(c);

    expect(run(compiled)).toBe(true);
    expect(compiled).not.toBe(c);
  });

  it("should protect infinite functional component", function () {
    var c = code.infinitefuncclass;
    var compiled = loopProtect(c);
    // assert(compiled !== c);
    // assert(spy(compiled) === 0);
    expect(run(compiled).props.children[0]).toBe("Some content with");
    expect(compiled).not.toBe(c);
  });

  it("should allow functional components to run", function () {
    var c = code.simplefunctionalclass;
    var compiled = loopProtect(c);
    var r = run(compiled);
    expect(compiled).not.toBe(c);
    expect(r).toStrictEqual(<div>Some Value</div>);
  });

  it('should handle non-keyword "class"', function () {
    var c = code.notclass;
    var compiled = loopProtect(c);
    var result = run(compiled);
    expect(compiled).toBe(c);
    expect(result).toBe(true);
  });
});
