import { Block, Element } from '../../typings/block';

export type Atom = Block | Element;

export interface Program {
  type: 'Program',
  body?: ASTLeaf,
}

export interface FunctionCall {
  type: 'FunctionCall',
  function: string,
  arguments: ASTLeaf[],
}

export interface VariableDeclaration {
  type: 'VariableDeclaration',
  variable: string,
  value: ASTLeaf,
}

export interface ImportStatement {
  type: 'ImportStatement',
  path: ASTLeaf,
}

export interface FuntionLambda {
  type: 'FunctionLambda',
  arguments: string[],
  body: ASTLeaf,
}

interface SpreadOperator {
  type: 'SpreadOperator',
  value: ASTLeaf,
}

interface PatternElement {
  arguments: any,
  body: ASTLeaf,
}

export interface PatternMatching {
  type: 'PatternMatching',
  pattern: ASTLeaf,
  props: PatternElement[],
}

export interface List {
  type: 'List',
  values: ASTLeaf[],
}

export interface Scope {
  type: 'Scope',
  body: ASTLeaf[],
}

export interface ConditionStatement {
  type: 'ConditionStatement',
  condition: ASTLeaf,
  then: ASTLeaf,
  otherwise: ASTLeaf, 
}

export interface ReturnStatement {
  type: 'ReturnStatement',
  value: ASTLeaf,
}

export interface Value {
  type: 'Number' | 'String' | 'Word',
  value: string | number,
}

export type ASTLeaf 
  = FunctionCall
  | FuntionLambda
  | ImportStatement
  | VariableDeclaration
  | Program
  | Scope
  | List
  | SpreadOperator
  | PatternMatching
  | ReturnStatement
  | ConditionStatement
  | Value;

const symbols = {};

const isLetter = str => RegExp(/^\p{L}/,'u').test(str);
const isValidName = name => name.split('').every(isLetter);

function getHash(input){
  let hash = 0, len = input.length;
  for (var i = 0; i < len; i++) {
    hash  = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0; // to 32bit integer
  }
  return Math.abs(hash);
}

export class Worker {
  private static program?: Program = null;
  public static process(ast: Atom): ASTLeaf {
    // Worker initializer
    if (!this.program) {
      this.program = { type: 'Program', body: null, };
      this.program.body = this.process(ast);
      return this.program;
    } 
    // Expression parsing
    else if (Array.isArray(ast)) {
      const [expr, ...args]: [Element, ...Atom[]] = <any>ast;
      switch (expr.value) {
        case 'begin': return {
          type: 'Scope',
          body: args.map(Worker.process.bind(this)),
        };

        case 'let': {
          const [ name, value ]: [Element, Atom] = <any>args;
          const variable = name.value.toString();
          const name_ = isValidName(variable)
            ? variable
            : symbols[variable] = '_' + getHash(variable);
          return {
            type: 'VariableDeclaration',
            variable: name_,
            value: Worker.process(value),
          }
        }

        case '...':
        case 'spread': {
          return {
            type: 'SpreadOperator',
            value: Worker.process(args[0]),
          }
        } 

        case 'match': {
          const [pattern, conditions_]: [Atom, Atom[]] = <any>args;
          const _ =conditions_.slice(1).map(x => {
            const xs = (<any[]>x).slice(1);
            const pattern_ = xs.slice(0, xs.length - 1);
            const then = xs[xs.length - 1];
            return {
              arguments: pattern_.map((y, i) => 
                Array.isArray(y) && y[0].value !== 'list'
                  ? ({
                      name: Worker.process(y[0]),
                      value: Worker.process(y[1]),
                    })
                  : Worker.process(y).type !== 'Word' 
                    ? ({
                        value: Worker.process(y),
                        name: {
                          type: 'Word',
                          value: '_' + i + getHash(i + Math.ceil(Math.random() * 100))
                        }
                      })
                    : ({
                        value: Worker.process(y)
                      })
              ),
              body: Worker.process(then),
            };
          })
          return {
            type: 'PatternMatching',
            pattern: Worker.process(pattern),
            props: _,
          };
        }

        case 'list': return {
          type: 'List',
          values: args.map(Worker.process.bind(this)),
        };

        case 'import': return {
          type: 'ImportStatement',
          path: Worker.process(args[0]),
        }

        case 'if': return {
          type: 'ConditionStatement',
          condition: Worker.process(args[0]),
          then: Worker.process(args[1]),
          otherwise: Worker.process(args[2]),
        };

        case 'return': return {
          type: 'ReturnStatement',
          value: Worker.process(args[0]),
        };

        case 'fn': {
          const [args_, body]: [Element[], Atom] = <any>args;
          const verifiedArgs = args_.map(x => {
            if (x.value.toString().startsWith('...')) {
              return x.value.toString();
            }
            if (isValidName(x.value.toString())) {
              return x.value.toString();
            } else {
              symbols[x.value.toString()] = '_' + getHash(x.value.toString());
              return symbols[x.value.toString()];
            }
          })
          return {
            type: 'FunctionLambda',
            arguments: verifiedArgs,
            body: Worker.process(body),
          }
        }

        default: {
          const fnName = Worker.process(expr)
          return {
            type: 'FunctionCall',
            function: fnName,
            arguments: args.map(Worker.process.bind(this)),
          }
        }
      }
    } 
    // Value parsing
    else  return ast && 'type' in ast && ast.type === 'Word'
      ? symbols[ast.value]
        ? { type: 'Word', value: symbols[ast.value] }
        : <Value>ast
      : <Value>ast;
  }
}