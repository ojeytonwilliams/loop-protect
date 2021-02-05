/* eslint-env node, jest */
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
    "class Test {\n constructor() { this.a = 1; }\n render() { var a = this.a;\n return(<div>{a}</div>);\n}\n}",
  simplefunctionalclass:
    "(() => {let a = 5999; const TestClass = () => { a++; return(<div>Some Value</div>); }; TestClass(); return a;})();",
  notclass:
    '(()=>{console.log("class");\nconsole.log("while");\nconsole.log(" foo do bar ");\nconsole.log(" foo while bar ");\nreturn true;})()',
  notprops:
    'var foo = { "class": "bar" }; if (foo["class"] && foo.do) {}\nreturn true;',
  infiniteclass:
    "class TestClass {\n constructor() {\n this.a = 1;\n }\n render() {\n return(\n <div><TestClass /></div>\n);\n }\n}",
  infinitefuncclass:
    "const FuncClass = () => { return(<div>Some content with<FuncClass /></div>); };",
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

  // https://github.com/jsbin/loop-protect/issues/16
  it("should handle class components", () => {
    const code = `(()=>{
            let b = 123;
          class ShoppingCart {
            constructor() {
            }
            render() {
                b++;
              { /* Change code below this line */ }
              return (<div>Testing all</div>)
              { /* Change code above this line */ }
            }
          };
          let a = new ShoppingCart();
          return b;
        })()`;

    const compiled = loopProtect(code);
    assert(run(compiled) === 124);
  });

  it("should rewrite class components", function () {
    var c = code.simpleclass;
    var compiled = loopProtect(c);
    assert(compiled !== c);
    var result = run(compiled);
    assert(result === 10);
  });

  it("should protect infinite class components", function () {
    var c = code.infiniteclass;
    var compiled = loopProtect(c);

    assert(compiled !== c);
    assert(spy(compiled) === true);
  });

  it("should protect infinite functional component", function () {
    var c = code.infinitefuncclass;
    var compiled = loopProtect(c);
    assert(compiled !== c);
    // assert(spy(compiled) === 0);
  });

  it("should allow functional components to run", function () {
    var c = code.simplefunctionalclass;
    var compiled = loopProtect(c);
    // console.log('\n---------\n' + c + '\n---------\n' + compiled);
    var r = run(compiled);
    expect(compiled).not.toBe(c);
    expect(r).toBe(60000);
  });

  it('should handle non-keyword "class"', function () {
    var c = code.notclass;
    var compiled = loopProtect(c);
    // console.log('\n---------\n' + c + '\n---------\n' + compiled);
    assert(compiled == c);
    var result = run(compiled);
    assert(result === true);
  });
});
