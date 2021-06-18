import { ASTLeaf } from './parser/worker';

export class Compiler {
  private static output: string = '';
  private static semicolon(isTopLevel: boolean): void {
    if (isTopLevel) this.output += ';';
  }
  public static compile(ast: ASTLeaf, isTopLevel = true, header?: string) {
    switch (ast.type) {
      case 'Program': {
        this.output += `
          (async function () { 
            const { matches } = require('z');
            const sub    = x => y => x - y;
            const div    = x => y => x / y;
            const less   = x => y => x < y;
            const equal  = x => y => x === y;
            const not    = cond => !cond;
            const and    = c1 => c2 => c1 && c2;
            const or     = c1 => c2 => c1 || c2;
            const print = console.log;
        `;
        this.compile(ast.body);
        this.output += '})()';
        this.semicolon(isTopLevel);
        break;
      }

      case 'ImportStatement': {
        console.log(ast.path);
        break;
      }

      case 'SpreadOperator': {
        this.output += '...';
        this.compile(ast.value, isTopLevel);
        break;
      }

      case 'PatternMatching': {
        this.output += 'matches(';
        this.compile(ast.pattern, false);
        this.output += ')(';
        ast.props.map(x => {
          this.output += '(';
          x.arguments.map(({ name, value }) => {
            if (name) {
              this.compile(name, false);
              this.output += ' = ';
            }
            this.compile(value, false);
            this.output += ',';
          });
          this.output += ') => ';
          this.compile(x.body, false);
          this.output += ',';
        })
        this.output += ')';
        this.semicolon(isTopLevel);
        break;
      }

      case 'List': {
        this.output += '[';
        ast.values.map((x, i) => {
          this.compile(x, false);
          this.output += i + 1 !== ast.values.length
            ? ','
            : '';
        });
        this.output += ']';
        break;
      }

      case 'Scope': {
        this.output += '{';
        ast.body.map(x => this.compile(x, true));
        this.output += '}';
        this.semicolon(isTopLevel);
        break;
      }

      case 'VariableDeclaration': {
        this.output += `const ${ast.variable} = `;
        this.compile(ast.value);
        this.semicolon(isTopLevel);
        break;
      }

      case 'ReturnStatement': {
        this.output += 'return ';
        this.compile(ast.value);
        this.semicolon(isTopLevel);
        break;
      }

      case 'ConditionStatement': {
        this.output += 'if(';
        this.compile(ast.condition, false);
        this.output += ') {';

        this.compile(ast.then);
        this.output += '}';
        
        if (ast.otherwise) {
          this.output += 'else {';
          this.compile(ast.otherwise);
          this.output += '}';
          this.semicolon(isTopLevel);
        } else {
          this.semicolon(isTopLevel);
        }
        break;
      }

      // Function related compilation
      case 'FunctionCall': {
        Compiler.compile(ast.function, false);
        ast.arguments.map((x, i) => {
          this.output += `(`;
          this.compile(x, false);
          this.output += ')';
        });
        this.semicolon(isTopLevel);
        break;
      }

      case 'FunctionLambda': {
        this.output += `${ast.arguments.map(x => `(${x})`).join(' => ')} => `;
        this.compile(ast.body, isTopLevel);
        break;
      }

      // Value compilation
      case 'Number':
      case 'Word': {
        this.output += ast.value.toString();
        this.semicolon(isTopLevel);
        break;
      }
      
      case 'String': {
        this.output += `"${ast.value}"`;
        this.semicolon(isTopLevel);
        break;
      }
    }
    return this.output;
  }
}