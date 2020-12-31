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
    extra = _ref.extra,
    isLoop = _ref.isLoop;

  return t.ifStatement(
    generateTimeoutElapsed({
      t,
      id,
      timeout,
    }),
    extra
      ? generateExtra({
          t,
          extra,
          line,
          ch,
          isLoop,
        })
      : isLoop
      ? t.breakStatement()
      : t.returnStatement()
  );
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
    ch = _ref3.ch,
    isLoop = _ref3.isLoop;

  return t.blockStatement([
    t.expressionStatement(
      t.callExpression(extra, [t.numericLiteral(line), t.numericLiteral(ch)])
    ),
    isLoop ? t.breakStatement() : t.returnStatement(),
  ]);
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
    iterations = _ref4.iterations,
    isLoop = _ref4.isLoop;

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
            t,
            id,
            timeout,
          })
        ),
        extra
          ? generateExtra({
              t,
              extra,
              line,
              ch,
            })
          : t.breakStatement()
      )
    : generateDateComparison({
        t,
        id,
        line,
        ch,
        timeout,
        extra,
        isLoop,
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

    const isLoop =
      t.isWhileStatement(path) ||
      t.isForStatement(path) ||
      t.isDoWhileStatement(path);

    var id = path.scope.generateUidIdentifier("LP");
    var counterId = path.scope.generateUidIdentifier("LPC");
    var counterVar = generateCounter(t, counterId);
    var startVar = generateStartVar(t, id);
    var inside = generateInside({
      t,
      id,
      counterId,
      line: path.node.loc.start.line,
      ch: path.node.loc.start.column,
      timeout,
      extra,
      iterations,
      isLoop,
    });
    var body = path.get("body"); // if we have an expression statement, convert it to a block

    // For Loop Protection
    if (isLoop) {
      if (!t.isBlockStatement(body)) {
        body.replaceWith(t.blockStatement([body.node]));
      }
      path.insertBefore(counterVar);
      path.insertBefore(startVar);
      body.unshiftContainer("body", inside);
    }
    // For Variable Declarations
    else if (
      body.container.type === "VariableDeclaration" &&
      body.container.declarations[0].init.type === "ArrowFunctionExpression"
    ) {
      path.insertBefore(counterVar);
      path.insertBefore(startVar);
      body.container.declarations[0].init.body.body.unshift(inside);
    }
    // For Class Declarations
    else if (t.isClassBody(body)) {
      path.insertBefore(counterVar);
      path.insertBefore(startVar);
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
        ClassDeclaration: protect(t, timeout, callback, iterations),
        VariableDeclaration: protect(t, timeout, callback, iterations),
      },
    };
  };
};
