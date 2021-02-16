const generateStartVar = (t, id) =>
  t.variableDeclaration("var", [
    t.variableDeclarator(
      id,
      t.callExpression(
        t.memberExpression(t.identifier("Date"), t.identifier("now")),
        []
      )
    ),
  ]);

const generateCounter = (t, id) =>
  t.variableDeclaration("var", [t.variableDeclarator(id, t.numericLiteral(1))]);

const generateDateComparison = ({
  t,
  id,
  line,
  ch,
  timeout,
  extra,
  isLoop,
} = {}) =>
  t.ifStatement(
    generateTimeoutElapsed({ t, id, timeout }),
    extra
      ? generateExtra({ t, extra, line, ch, isLoop })
      : isLoop
      ? t.breakStatement()
      : t.returnStatement()
  );

const generateTimeoutElapsed = ({ t, id, timeout } = {}) =>
  t.binaryExpression(
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

const generateExtra = ({ t, extra, line, ch, isLoop } = {}) =>
  t.blockStatement([
    t.expressionStatement(
      t.callExpression(extra, [t.numericLiteral(line), t.numericLiteral(ch)])
    ),
    isLoop ? t.breakStatement() : t.returnStatement(),
  ]);

const generateInside = ({
  t,
  id,
  counterId,
  line,
  ch,
  timeout,
  extra,
  iterations,
  isLoop,
} = {}) =>
  iterations
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
          generateTimeoutElapsed({ t, id, timeout })
        ),
        extra
          ? generateExtra({ t, extra, line, ch, isLoop })
          : t.breakStatement()
      )
    : generateDateComparison({ t, id, line, ch, timeout, extra, isLoop });

const protect = (t, timeout, extra, iterations) => (path) => {
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
  const id = path.scope.generateUidIdentifier("LP");
  const counterId = path.scope.generateUidIdentifier("LPC");
  const counterVar = generateCounter(t, counterId);
  const startVar = generateStartVar(t, id);
  const inside = generateInside({
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
  const body = path.get("body");

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
    body?.container?.type === "VariableDeclaration" &&
    body?.container?.declarations?.[0]?.init?.type === "ArrowFunctionExpression"
  ) {
    path.insertBefore(counterVar);
    path.insertBefore(startVar);
    const ele = body?.container?.declarations?.[0]?.init?.body?.body;
    if (ele.length) {
      ele.unshift(inside);
    }
  }
  // For Class Declarations
  else if (t.isClassBody(body)) {
    path.insertBefore(counterVar);
    path.insertBefore(startVar);
    const ele = body?.node?.body?.find((node) => node?.key?.name === "render")
      ?.body?.body;
    if (ele.length) {
      ele.unshift(inside);
    }
  }
};

module.exports = (timeout = 100, extra = null, iterations = null) => {
  const anonRegex = /^function\s*\(/;
  if (typeof extra === "string") {
    const string = extra;
    extra = `() => console.error("${string.replace(/"/g, '\\"')}")`;
  } else if (extra !== null) {
    extra = extra.toString();
    if (extra.match(anonRegex)) {
      // fix anonymous functions as they'll cause
      // the callback transform to blow up
      extra = extra.replace(anonRegex, "function callback(");
    }
  }

  return ({ types: t, transform }) => {
    const node = extra
      ? transform(extra, { ast: true }).ast.program.body[0]
      : null;

    let callback = null;
    if (t.isExpressionStatement(node)) {
      callback = node.expression;
    } else if (t.isFunctionDeclaration(node)) {
      callback = t.functionExpression(null, node.params, node.body);
    }

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
