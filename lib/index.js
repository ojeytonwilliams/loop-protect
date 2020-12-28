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
    console.log("path: ", path);
    var body = path.get("body"); // if we have an expression statement, convert it to a block
    console.log("body and isClassBody: ", body, t.isClassBody(body));

    if (t.isClassBody(body)) {
      const renderNode = body.node.body.find(
        (node) => node.key.name === "render"
      );
      console.log("renderNode: ", renderNode);
      // body.replaceWith(t.blockStatement([body.node.body[1].body]))
    } else if (!t.isBlockStatement(body)) {
      body.replaceWith(t.blockStatement([body.node]));
    }

    path.insertBefore(counterVar);
    path.insertBefore(startVar);
    body.unshiftContainer("body", inside);
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
        ClassBody: protect(t, timeout, callback, iterations),
        // ObjectMethod: protect(t, timeout, callback, iterations),
        ClassDeclaration: protect(t, timeout, callback, iterations),
      },
    };
  };
};
