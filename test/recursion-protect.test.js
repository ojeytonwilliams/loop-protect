/* eslint-env node, jest */
const React = require("react");
const Enzyme = require("enzyme");
const Adapter = require("enzyme-adapter-react-16");
Enzyme.configure({ adapter: new Adapter() });
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
  withreplace: `(()=>{
        var myNoun = "dog";
        var myAdjective = "big";
        var myVerb = "ran";
        var myAdverb = "quickly";
        var wordBlanks = "Once there was a " + myNoun + " which was very " + myAdjective + ". ";
        wordBlanks += "It " + myVerb + " " + myAdverb + " around the yard.";
        return wordBlanks;
    })();
        `,
  stackedarrowfunctions:
    "(()=> { const add = x => y => z => x + y + z; return add;})();",
  mockclass: `(()=>{
    class MyComponent extends React.Component {
      constructor(props) {
        super(props);
        this.state = {
          name: 'Initial State'
        };
        this.handleClick = this.handleClick.bind(this);
      }
      handleClick() {
        // Change code below this line
        this.setState({
          name: 'React Rocks!'
        });
        // Change code above this line
      }
      render() {
        return (
          <div>
            <button onClick = {this.handleClick}>Click Me</button>
            <h1>{this.state.name}</h1>
          </div>
        );
      }
    }
    return MyComponent;
  })();
    `,
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

  it("should not break with .replace()", function () {
    const removeAssignments = (str) =>
      str
        .replace(/myNoun\s*=\s*["']dog["']/g, "")
        .replace(/myAdjective\s*=\s*["']big["']/g, "")
        .replace(/myVerb\s*=\s*["']ran["']/g, "")
        .replace(/myAdverb\s*=\s*["']quickly["']/g, "");

    var c = code.withreplace;
    var compiled = loopProtect(c);
    var newCode = removeAssignments(compiled);
    var result = run(compiled);

    expect(
      !/dog/.test(newCode) &&
        !/ran/.test(newCode) &&
        !/big/.test(newCode) &&
        !/quickly/.test(newCode)
    ).toBe(true);
    expect(
      /\bdog\b/.test(result) &&
        /\bbig\b/.test(result) &&
        /\bran\b/.test(result) &&
        /\bquickly\b/.test(result)
    ).toBe(true);
  });

  it("should not break on stacked arrow functions", function () {
    var c = code.stackedarrowfunctions;
    var compiled = loopProtect(c);
    var result = run(compiled);
    expect(result(2)(4)(6)).toBe(12);
  });

  it("should allow Enzyme.mount state handling", async function () {
    const test = async (MyComponent) => {
      const waitForIt = (fn) =>
        new Promise((resolve, reject) => setTimeout(() => resolve(fn()), 250));
      const mockedComponent = Enzyme.mount(React.createElement(MyComponent));
      console.log("mock: ", mockedComponent);
      const first = () => {
        mockedComponent.setState({ name: "Before" });
        return waitForIt(() => mockedComponent.state("name"));
      };
      const second = () => {
        mockedComponent.instance().handleClick();
        return waitForIt(() => mockedComponent.state("name"));
      };
      const firstValue = await first();
      const secondValue = await second();
      expect(firstValue).toStrictEqual("Before");
      expect(secondValue).toStrictEqual("React Rocks!");
    };
    var c = code.mockclass;
    var compiled = loopProtect(c);
    console.log("comp: ", compiled);
    var result = run(compiled);
    console.log("res: ", result);
    await test(result);
  });
});
