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

const generateDateComparison = ({ t, id, line, ch, timeout, extra } = {}) =>
  t.ifStatement(
    generateTimeoutElapsed({ t, id, timeout }),
    extra ? generateExtra({ t, extra, line, ch }) : t.breakStatement()
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

const generateExtra = ({ t, extra, line, ch } = {}) =>
  t.blockStatement([
    t.expressionStatement(
      t.callExpression(extra, [t.numericLiteral(line), t.numericLiteral(ch)])
    ),
    t.breakStatement(),
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
        extra ? generateExtra({ t, extra, line, ch }) : t.breakStatement()
      )
    : generateDateComparison({ t, id, line, ch, timeout, extra });

const protect = (t, timeout, extra, iterations) => (path) => {
  if (!path.node.loc) {
    // I don't really know _how_ we get into this state
    // but https://jsbin.com/mipesawapi/1/ triggers it
    // and the node, I'm guessing after translation,
    // doesn't have a line in the code, so this blows up.
    return;
  }
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
  });
  const body = path.get("body");

  // if we have an expression statement, convert it to a block
  if (!t.isBlockStatement(body)) {
    body.replaceWith(t.blockStatement([body.node]));
  }
  path.insertBefore(counterVar);
  path.insertBefore(startVar);
  body.unshiftContainer("body", inside);
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
      },
    };
  };
};
