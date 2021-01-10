import type { Block, Element } from '../typings/block.ts';
import { Parser } from './parser.ts';

export class Node {
  public static async process(block: Block): Promise<void | ValueElement> {
    for (const child of block) {
      let res: undefined | [ValueElement, boolean] = await Interpreter.process(child);
      if (res && res[1] && res[1] === true) {
        return res[0];
      }
    }
  }
}

export class Variable {
  public static async declare(variable: Element, value: Block | Element) {
    Frame.frame.variables.push({
      name: await Identifier.process(variable) as string,
      value: await Interpreter.process(value) as ValueElement,
    });
  }

  public static async update(variable: Element, value: Element | Block): Promise<void> {
    let identifier = await Identifier.process(variable);
    if (typeof identifier === 'string') {
      const frameItem = Frame.variables.get(identifier) as ValueElement;
      if (!Frame.exists(identifier)) throw 'Variable ' + identifier + ' does not exists!';
      return Value.update(frameItem, Interpreter.process(value));
    }
    if ('index' in identifier) {
      const variable = Frame.variables.get(identifier.variable) as ValueElement;
      if ('value' in variable && variable.value) {
        const split = (<string>variable.value).split('');
        const updateValue = await Interpreter.process(value);
        split.splice(identifier.index, updateValue.value.length, updateValue.value)
        variable.value = split.join('');
      }
    }
    return Value.update(identifier, Interpreter.process(value));
  }
}

export class Identifier {
  public static async process(element: Element): Promise<string | { variable: any, index: any, }> {
    if (Array.isArray(element) && element[0].type === 'Word' && element[0].value === 'index') {
      const index = await List.index(element[1], element[2]);
      if (isObject(index)) {
        return index;
      }
      return { variable: element[1].value, index: element[2].value };
    }
    if ('value' in element) return element.value as string;
    throw 'Variable name is not correct!';
  }
}

export class Value {
  public static process(value: Element): ValueElement extends FunctionType ? never : ValueElement {
    if (value.value === 'none') return { type: Types.None, value: undefined };
    if (value.type === 'Word' && Frame.exists(value.value as string)) {
      const variable: ValueElement = Frame.variables.get(value.value as string) as ValueElement;
      return variable.type === Types.Function ? { type: Types.None, value: undefined } : variable;
    }
    return value.value !== undefined ? value as ValueElement : { type: Types.None, value: undefined };
  }

  public static update(current: any, next: any): void {
    const loop = Object.entries(next);
    for (const item of loop) current[item[0]] = item[1];
  }
}

function isContainer(element: Block | Element): boolean {
  return Array.isArray(element) && element.every((child) => Array.isArray(child));
}

function isValue(element: Block | Element): boolean {
  return element && 'value' in element && 'type' in element;
}

function isObject(element: any): boolean {
  return !Array.isArray(element) && typeof element === 'object';
}

enum Types {
  String = 'String',
  Integer = 'Integer',
  Function = 'Function',
  Boolean = 'Boolean',
  None = 'None',
  List = 'List',
}

interface ListType {
  type: Types.List,
  value: ValueElement[],
}

interface StringType {
  type: Types.String,
  value: string,
}

interface NoneType {
  type: Types.None,
  value: undefined,
}

interface IntegerType {
  type: Types.Integer,
  value: number,
}

interface FunctionType {
  type: Types.Function,
  args: Element[],
  body: Block,
}

interface BooleanType {
  type: Types.Boolean,
  value: boolean,
}

type ValueElement = StringType | IntegerType | FunctionType | BooleanType | NoneType;
interface Stack {
  variables: {
    name: string,
    value: ValueElement,
  }[]
}

export class Frame {
  private static stack: Stack[] = [{ variables: [] }];
  public static pushStackFrame(): void {
    this.stack.push({
      variables: [],
    });
  }

  public static get frame(): Stack extends null | undefined ? never : Stack {
    return this.stack[this.stack.length - 1];
  }

  public static popStackFrame(): void {
    this.stack.pop();
  }

  public static exists(identifier: string) {
    return this.variables.get(identifier);
  }

  public static get variables(): Map<string, Value> {
    let map = new Map();
    for (const frame of this.stack) {
      for (const variable of frame.variables) {
        map.set(variable.name, variable.value);
      }
    }
    return map;
  }
}

export class Function {
  public static declare(args: (Element extends Block ? never : Element)[], body: Block): FunctionType {
    return {
      type: Types.Function,
      args,
      body,
    }
  }

  public static async call(functionName: string, args: (Block | Element)[]) {
    const fn: FunctionType = Frame.variables.get(functionName) as FunctionType;
    Frame.pushStackFrame();
    for (let binding in fn.args) await Variable.declare(fn.args[binding], args[Number(binding)]);
    let res: any = await Interpreter.process(fn.body);
    Frame.popStackFrame();
    return res || { type: Types.None, value: undefined };
  }

  public static async return(value: Block | Element): Promise<[ValueElement, boolean]> {
    return [await Interpreter.process(value), true];
  }
}

export class Equalities {
  public static async process(operation: string, left: Block | Element, right: Block | Element): Promise<BooleanType> {
    const lhs = (await Interpreter.process(left)).value;
    const rhs = (await Interpreter.process(right)).value;
    switch (operation) {
      case '<': return { type: Types.Boolean, value: lhs < rhs };
      case '>': return { type: Types.Boolean, value: lhs > rhs };
      case '<=': return { type: Types.Boolean, value: lhs <= rhs };
      case '>=': return { type: Types.Boolean, value: lhs >= rhs };
      case '=': return { type: Types.Boolean, value: lhs == rhs };
      case '!=': return { type: Types.Boolean, value: lhs != rhs };
    }
    return { type: Types.Boolean, value: false, }
  }
}

export class While {
  public static async process(condition: Block | Element, body: Block | Element): Promise<[ValueElement, boolean] | void> {
    while ((await Interpreter.process(condition)).value) {
      const res = await Interpreter.process(body);
      if (res) return [res, true];
    }
  }
}

export class Arithmetic {
  private static determineType(lhs: ValueElement, rhs: ValueElement, operation: string): Types.Integer | Types.String {
    if (operation === '+') {
      if (lhs.type === Types.String || rhs.type === Types.Integer) return Types.String;
    }
    return Types.Integer;
  }

  public static async process(operation: string, left: Block | Element, right: Block | Element): Promise<StringType | IntegerType | NoneType> {
    const lhs: Exclude<ValueElement, FunctionType | BooleanType> = await Interpreter.process(left);
    const rhs: Exclude<ValueElement, FunctionType | BooleanType> = await Interpreter.process(right);
    const type: Types = this.determineType(lhs, rhs, operation);

    switch (operation) {
      case '+': return { type, value: <any>lhs.value + rhs.value };
      case '-': return { type, value: <any>lhs.value - <any>rhs.value } as IntegerType;
      case '*': return { type, value: <any>lhs.value * <any>rhs.value } as IntegerType;
      case '/': return { type, value: <any>lhs.value / <any>rhs.value } as IntegerType;
    }

    return { type: Types.None, value: undefined };
  }
}

export class Condition {
  public static async check(condition: Element | Block, then: Element | Block, or: Element | Block): Promise<any> {
    if ((await Interpreter.process(condition)).value) return await Interpreter.process(then);
    return await Interpreter.process(or);
  }
}

export class Import {
  public static async import(url: Element) {

  }
}

export class List {
  public static async create(args: (Element | Block)[]): Promise<ListType> {
    const value = []
    for (const arg of args) value.push(await Interpreter.process(arg));
    return { type: Types.List, value, };
  }

  public static async index(variable: Element, index: Element): Promise<any> {
    const element = await Interpreter.process(variable);
    index = await Interpreter.process(index);
    if (element.type === Types.Function) return { type: Types.None, value: undefined };
    if ('value' in element && element.value !== undefined) { // @ts-ignore
      const foundIndex = element.value[index.value];
      if (typeof foundIndex === 'string') return { type: element.type, value: foundIndex };
      return foundIndex || { variable: variable.value, index: index.value };
    }
    return { type: Types.None, value: undefined };
  }
}

export class Interpreter {
  public static async process(block: Block | Element, cwd?: string extends number ? never : string): Promise<any> {
    if (isValue(block)) return Value.process(block as Element);
    if (isContainer(block)) {
      Frame.pushStackFrame();
      const res = await Node.process(block as Block);
      Frame.popStackFrame();
      return res;
    }
    if (block === undefined) return { type: Types.None, value: undefined };
    const [ expr, ...args ] = block as (Block | Element)[];
    const expression: Element = expr as Element;

    if (expression.value === 'let') return await Variable.declare(args[0] as Element, args[1]);
    if (expression.value === 'set') return await Variable.update(args[0] as Element, args[1]);
    if (expression.value === 'fn') return await Function.declare(args[0] as Element[], args[1] as Block);
    if (expression.value === 'if') return await Condition.check(args[0], args[1], args[2]);
    if (expression.value === 'return') return await Function.return(args[0]);
    if (expression.value === 'while') return await While.process(args[0], args[1]);
    if (expression.value === 'list') return await List.create(args);
    if (expression.value === 'import') return await Import.import(args[0] as Element);
    if (expression.value === 'index') return await List.index(args[0] as Element, args[1] as Element)
    if (['<', '=', '!=', '>', '<=', '>='].includes(expression.value as string)) return await Equalities.process(expression.value as string, args[0], args[1]);
    if (['+', '-', '*', '/'].includes(expression.value as string)) return await Arithmetic.process(expression.value as string, args[0], args[1]);

    if (expression.value === 'print') {
      const values = [];
      for (const arg of args) values.push(await Interpreter.process(arg));
      return console.log(...values.map((x: any) => x.value));
    }

    if (Frame.exists(expression.value as string)) {
      const item: ValueElement = Frame.variables.get(expression.value as string) as ValueElement;
      if (item.type === Types.Function) return await Function.call(expression.value as string, args);
      return item;
    }
    if ([Types.String, Types.Integer, Types.Boolean].includes(expression.type as Types)) return expression;

    throw `Can't recognize this expression: ${expression.value}`;
  }

  public static run(source: string) {
    const ast = Parser.parse(source);
    return this.process(ast);
  }
}