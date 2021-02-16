/* eslint-env node, jest */
const Babel = require("@babel/standalone");

const code = `let i = 0; while (true) { i++; }; done(i)`;

let done = jest.fn();

beforeEach(() => {
  done = jest.fn();
});

const transform = (id) => (code) =>
  Babel.transform(new Function(code).toString(), {
    plugins: [id],
  }).code; // eslint-disable-line no-new-func

const run = (code) => {
  // console.log(code);
  eval(`(${code})()`); // eslint-disable-line no-eval
};

test("10 iterations", () => {
  const id = "lp1";
  Babel.registerPlugin(id, require("../lib")(100, null, 10));
  const after = transform(id)(code);
  run(after);
  expect(done).toBeCalledWith(expect.any(Number));
});

test("anonymous callback and 10 iterations", () => {
  const id = "lp2";
  Babel.registerPlugin(
    id,
    require("../lib")(100, (line) => done(`line: ${line}`), 10)
  );
  const after = transform(id)(code);
  run(after);
  expect(done).toHaveBeenCalledWith("line: 3");
});

test("arrow function callback and 10 iterations", () => {
  const id = "lp3";
  const callback = (line) => done(`lp3: ${line}`);

  Babel.registerPlugin(id, require("../lib")(100, callback, 10));
  const after = transform(id)(code);
  run(after);
  expect(done).toHaveBeenCalledWith(`${id}: 3`);
});

test("named function callback and 10 iterations", () => {
  const id = "lp4";
  function callback(line) {
    done(`lp4: ${line}`);
  }

  Babel.registerPlugin(id, require("../lib")(100, callback, 10));
  const after = transform(id)(code);
  run(after);
  expect(done).toHaveBeenCalledWith(`${id}: 3`);
});

test("named function callback and 1000 iterations", () => {
  const id = "lp5";
  const iterations = 1000;
  function callback(line) {
    done(`lp5: ${line}`);
  }

  Babel.registerPlugin(id, require("../lib")(100, callback, iterations));
  const after = transform(id)(code);
  run(after);
  expect(done).toHaveBeenCalledWith(`${id}: 3`);
  // iteration counter starts at 1, so the first pass through the loop does not
  // check the date, since we have no reason to believe it is infinite at the
  // start
  expect(done.mock.calls[1][0] % iterations).toBe(999);
});

test("no callback and 10000 iterations", () => {
  const id = "lp6";
  const iterations = 10000;

  Babel.registerPlugin(id, require("../lib")(100, null, iterations));
  const after = transform(id)(code);
  run(after);
  expect(done).toBeCalledWith(expect.any(Number));
  expect(done.mock.calls[0][0] % iterations).toBe(9999);
});

test("two loops", () => {
  const id = "lp7";
  const iterations = 100;
  const twoLoops = `let i = 0; while (i < 5) { i++; }; while (true) { i++; }; done(i)`;

  Babel.registerPlugin(id, require("../lib")(100, null, iterations));
  const after = transform(id)(twoLoops);
  run(after);
  expect(done).toBeCalledWith(expect.any(Number));
  // (5 + 99) % 100 == 4
  expect(done.mock.calls[0][0] % iterations).toBe(4);
});
