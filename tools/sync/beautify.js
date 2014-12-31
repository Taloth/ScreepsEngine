"use strict";
var uglify = require('uglify-js');

// Rules
var rules = [];

// Only var x = <constant> assignments may be concatenated.
rules.push(function(before, in_list, context) {

    if (in_list && before instanceof uglify.AST_Var && before.definitions.length > 1) {

        context.logNode(before, in_list);

        var results = [];
        var currentDefinitions = [];
        for (var i = 0; i < before.definitions.length; i++) {
            var varDef = before.definitions[i];
            if (varDef.value && !(varDef.value instanceof uglify.AST_Constant)) {
                if (currentDefinitions.length) {
                    results.push(new uglify.AST_Var({definitions: currentDefinitions}));
                    currentDefinitions = [];
                }
                if (results.length) {
                    context.logChange('<splitting Var>');
                    context.logNode(before, in_list);
                }
                results.push(new uglify.AST_Var({definitions: [varDef]}));
            } else {
                currentDefinitions.push(varDef);
            }
            context.descendInto(varDef);
        }

        if (currentDefinitions.length) {
            if (results.length) {
                context.logChange('<splitting Var>');
                context.logNode(before, in_list);
            }
            results.push(new uglify.AST_Var({definitions: currentDefinitions}));
        }

        return uglify.MAP.splice(results);
    }

    return false;
});

function spliceSeqChain(node, property) {
    var result = [];

    var target = node[property];

    while (target instanceof uglify.AST_Seq) {
        var car = new uglify.AST_SimpleStatement({body: target.car});
        result.push(car);
        target = target.cdr;
    }

    var clone = node.clone();
    clone[property] = target;

    result.push(clone);

    return result;
}

// We don't want ',' statements.
rules.push(function(before, in_list, context) {
    var result;

    if (in_list && before instanceof uglify.AST_SimpleStatement && before.body instanceof uglify.AST_Seq) {
        result = spliceSeqChain(before, 'body');

    } else if (in_list && before instanceof uglify.AST_Exit && before.value && before.value instanceof uglify.AST_Seq) {
        result = spliceSeqChain(before, 'value');

    } else if (in_list && before instanceof uglify.AST_If && before.condition && before.condition instanceof uglify.AST_Seq) {
        result = spliceSeqChain(before, 'condition');

    } else if (before instanceof uglify.AST_BlockStatement) {
        for (var i = 0; i<before.body.length;i++) {
            if (before.body[i] instanceof uglify.AST_Seq) {
                var stmt = new uglify.AST_SimpleStatement({ body: before.body[i] });
                var stmts = spliceSeqChain(stmt, 'body');
                if (result) {
                    result = result.concat(stmts);
                } else {
                    result = stmts;
                }
            }
        }
        if (result) {
            context.log('<Splicing Seq chain>');
            var clone = before.clone();
            clone.body = result;
            clone.transform(context.walker);
            return clone;
        }
    }

    if (!result) {
        return;
    }

    context.log('<Splicing Seq chain>');

    result.forEach(context.transform);

    return uglify.MAP.splice(result);
});

// !0 = true !1 = false
rules.push(function(before, in_list, context) {
    if (before instanceof uglify.AST_Unary && before.operator == '!') {
        if (before.expression instanceof uglify.AST_Number && before.expression.value === 0) {
            return new uglify.AST_True();
        } else if (before.expression instanceof uglify.AST_Number && before.expression.value === 1) {
            return new uglify.AST_False();
        }
    }
});

function spliceConditional(node, property) {
    var conditional = node[property];

    var cloneConsequent = node.clone();
    var cloneAlternative = node.clone();
    cloneConsequent[property] = conditional.consequent;
    cloneAlternative[property] = conditional.alternative;

    var result = new uglify.AST_If({
        condition: conditional.condition,
        body: new uglify.AST_BlockStatement({ body: [ cloneConsequent ] }),
        alternative: new uglify.AST_BlockStatement({ body: [ cloneAlternative ] })
    })

    return result;
}

// We don't want '? :' statements.
rules.push(function(before, in_list, context) {
    if (!in_list) {
        return;
    }

    var result;

    if (before instanceof uglify.AST_Exit && before.value && before.value instanceof uglify.AST_Conditional) {
        result = spliceConditional(before, 'value');
    }

    else if (before instanceof uglify.AST_Assign && before.right && before.right instanceof uglify.AST_Conditional) {
        result = spliceConditional(before, 'right');
    }

    else if (before instanceof uglify.AST_SimpleStatement && before.body instanceof uglify.AST_Conditional) {
        result = spliceConditional(before, 'body');
    }

    if (!result) {
        return;
    }

    context.logChange('<Splicing Tertiary Conditional>');

    result.transform(context.walker);

    return result;
});

// We don't want 'ab && doSomething()' statements.
rules.push(function(before, in_list, context) {
    if (!in_list) {
        return;
    }

    var result;

    if (before instanceof uglify.AST_SimpleStatement && before.body instanceof uglify.AST_Binary && before.body.operator == '&&') {
        result = new uglify.AST_If({
            condition: before.body.left,
            body: new uglify.AST_BlockStatement({ body: [ before.body.right ] }),
            alternative: null

        });
    }

    if (!result) {
        return;
    }

    context.logChange('<Splicing Inline Conditional>');

    result.transform(context.walker);

    return result;
});

module.exports = function(code, debug) {

        var ast = uglify.parse(code, {fromString: true});

        var context = {
            depth: 0,
            changed: true,
            logChange: function(msg) { },
            log: function(msg) { },
            logNode: function(msg) { },
            descendInto: function(node) { },
            transform: function(node) { }
        };
        context.logChange = function(msg) {
            context.changed = true;
            context.log(msg);
        };

        if (debug) {
            context.log = function (msg) {
                console.log(new Array(context.depth * 2 + 1).join(' ') + msg);
            }

            context.logNode = function (node, in_list) {
                var msg = node.TYPE;
                if (in_list) {
                    msg += ' [in list]';
                }
                if (node.operator) {
                    msg += ' [' + node.operator + ']';
                }
                context.log(msg);
            }
        }


        context.descendInto = function(node) {
            context.depth++;
            node.transform(context.walker);
            context.depth--;
        };

        context.transform = function(node) {
            node.transform(context.walker);
        };

        context.walker = new uglify.TreeTransformer(function(before, descend, in_list) {

            for (var i = 0; i < rules.length; i++) {
                var result = rules[i](before, in_list, context);
                if (result !== false && result !== void 0) {
                    return result;
                }
            }

            context.logNode(before, in_list);

            context.depth++;
            descend(before, this);
            context.depth--;

            return before;

        }, function(after, in_list) {
            return after;
        });

        for (var i = 0; i < 10 && context.changed; i++) {
            context.changed = false;
            ast = ast.transform(context.walker);
        }

        var stream = uglify.OutputStream({ beautify: true, bracketize: true, semicolons: true, width: 120 });
        ast.print(stream);
        return stream.toString();
    };