"use strict";

var generateStartVar = function generateStartVar(t, id) {
  return t.variableDeclaration("var", [
    t.variableDeclarator(
      id,
      t.callExpression(
        t.memberExpression(t.identifier("Date"), t.identifier("now")),
        []
      )
    ),
  ]);
};

var generateCounter = function generateCounter(t, id) {
  return t.variableDeclaration("var", [
    t.variableDeclarator(id, t.numericLiteral(1)),
  ]);
};

var generateDateComparison = function generateDateComparison() {
  var _ref =
      arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    t = _ref.t,
    id = _ref.id,
    line = _ref.line,
    ch = _ref.ch,
    timeout = _ref.timeout,
    extra = _ref.extra;

  return t.ifStatement(
    generateTimeoutElapsed({
      t: t,
      id: id,
      timeout: timeout,
    }),
    extra
      ? generateExtra({
          t: t,
          extra: extra,
          line: line,
          ch: ch,
        })
      : t.returnStatement()
  ); //t.breakStatement());
};

var generateTimeoutElapsed = function generateTimeoutElapsed() {
  var _ref2 =
      arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    t = _ref2.t,
    id = _ref2.id,
    timeout = _ref2.timeout;

  return t.binaryExpression(
    ">",
    t.binaryExpression(
      "-",
      t.callExpression(
        t.memberExpression(t.identifier("Date"), t.identifier("now")),
        []
      ),
      id
    ),
    t.numericLiteral(timeout)
  );
};

var generateExtra = function generateExtra() {
  var _ref3 =
      arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    t = _ref3.t,
    extra = _ref3.extra,
    line = _ref3.line,
    ch = _ref3.ch;

  return t.blockStatement([
    t.expressionStatement(
      t.callExpression(extra, [t.numericLiteral(line), t.numericLiteral(ch)])
    ),
    t.returnStatement(),
  ]); // t.breakStatement()]);
};

var generateInside = function generateInside() {
  var _ref4 =
      arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    t = _ref4.t,
    id = _ref4.id,
    counterId = _ref4.counterId,
    line = _ref4.line,
    ch = _ref4.ch,
    timeout = _ref4.timeout,
    extra = _ref4.extra,
    iterations = _ref4.iterations;

  return iterations
    ? t.ifStatement(
        t.logicalExpression(
          "&&",
          t.binaryExpression(
            "===",
            t.binaryExpression(
              "%",
              t.updateExpression("++", counterId),
              t.numericLiteral(iterations)
            ),
            t.numericLiteral(0)
          ),
          generateTimeoutElapsed({
            t: t,
            id: id,
            timeout: timeout,
          })
        ),
        extra
          ? generateExtra({
              t: t,
              extra: extra,
              line: line,
              ch: ch,
            })
          : t.breakStatement()
      )
    : generateDateComparison({
        t: t,
        id: id,
        line: line,
        ch: ch,
        timeout: timeout,
        extra: extra,
      });
};

var protect = function protect(t, timeout, extra, iterations) {
  return function (path) {
    if (!path.node.loc) {
      // I don't really know _how_ we get into this state
      // but https://jsbin.com/mipesawapi/1/ triggers it
      // and the node, I'm guessing after translation,
      // doesn't have a line in the code, so this blows up.
      return;
    }

    var id = path.scope.generateUidIdentifier("LP");
    var counterId = path.scope.generateUidIdentifier("LPC");
    var counterVar = generateCounter(t, counterId);
    var startVar = generateStartVar(t, id);
    var inside = generateInside({
      t: t,
      id: id,
      counterId: counterId,
      line: path.node.loc.start.line,
      ch: path.node.loc.start.column,
      timeout: timeout,
      extra: extra,
      iterations: iterations,
    });
    // console.log('path: ', path, inside);
    var body = path.get("body"); // if we have an expression statement, convert it to a block
    console.log("path: ", path);
    console.log("body: ", body);

    if (t.isClassBody(body)) {
      // const renderNode = body.node.body.find(node => node.key.name === 'render');
      // console.log('renderNode: ', renderNode);
      // body.replaceWith(t.blockStatement([body.node.body[1].body]))
    } else if (!t.isBlockStatement(body)) {
      // body.replaceWith(t.blockStatement([body.node]));
    }

    path.insertBefore(counterVar);
    path.insertBefore(startVar);

    // For Loop Protection
    // body.unshiftContainer('body', inside);

    // For Variable Declarations
    if (body.container.type === "VariableDeclaration") {
      body.container.declarations[0].init.body.body.unshift(inside);
    }
    // For Class Declarations
    if (t.isClassBody(body)) {
      body.node.body
        .find((node) => node.key && node.key.name === "render")
        .body.body.unshift(inside);
    }
  };
};

module.exports = function () {
  var timeout =
    arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 100;
  var extra =
    arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var iterations =
    arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  var anonRegex = /^function\s*\(/;
  if (typeof extra === "string") {
    var string = extra;
    extra = '() => console.error("'.concat(string.replace(/"/g, '\\"'), '")');
  } else if (extra !== null) {
    extra = extra.toString();

    if (extra.match(anonRegex)) {
      // fix anonymous functions as they'll cause
      // the callback transform to blow up
      extra = extra.replace(anonRegex, "function callback(");
    }
  }

  return function (_ref5) {
    var t = _ref5.types,
      transform = _ref5.transform;
    var node = extra
      ? transform(extra, {
          ast: true,
        }).ast.program.body[0]
      : null;
    var callback = null;

    if (t.isExpressionStatement(node)) {
      callback = node.expression;
    } else if (t.isFunctionDeclaration(node)) {
      callback = t.functionExpression(null, node.params, node.body);
    }
    console.log(t);

    return {
      visitor: {
        WhileStatement: protect(t, timeout, callback, iterations),
        ForStatement: protect(t, timeout, callback, iterations),
        DoWhileStatement: protect(t, timeout, callback, iterations),
        // ClassMethod: protect(t, timeout, callback, iterations),
        // ExpressionStatement: protect(t, timeout, callback, iterations),
        // ClassBody: protect(t, timeout, callback, iterations),
        // ObjectMethod: protect(t, timeout, callback, iterations),
        ClassDeclaration: protect(t, timeout, callback, iterations),
        VariableDeclaration: protect(t, timeout, callback, iterations),
      },
    };
  };
};
