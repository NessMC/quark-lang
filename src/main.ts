import { File } from './utils/file';
import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import { Parser } from './core/parser/parser';
import { Worker } from './core/parser/worker';
import { Compiler } from './core/compiler';
import { minify } from 'terser';

export function arrayToObject(array: string[][]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of array)
    result[item[0]] = item[1];
  return result;
}

export function parseConfiguration(content: string): Record<string, string> {
  const lines = content.split(/\r?\n/g);
  const parsed = lines.map((acc) => acc
    .split('=')
    .map((x) => x.trim())
  );
  const error = parsed.find((x) => x[0].length === 0 || x[1].length === 0);
  const index = parsed.findIndex((x) => x === error);
  if (error !== undefined) {
    throw `Empty value or property at line ${index}: ${lines[index]}`;
  }
  return arrayToObject(parsed);
}

export function getQuarkFolder(): string {
  const variable = process.env['QUARK'];
  if (variable === undefined) 
    throw `You have to export QUARK variable: export QUARK="path/to/quark"`;
  return variable || undefined;
}

async function main(): Promise<void> {
  // Getting sample code content and interpreting it
  const src = path.join('sample', 'factorial.qrk');
  const script = await File.read(src);
  const ast = Parser.parse(script, src);

  const reworked = Worker.process(ast[0]);
  const js = Compiler.compile(reworked);
  console.log(js)
  const { code } = await minify({
    'src': js,
  });
  eval(code);
}
main();