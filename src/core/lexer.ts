import {
  Token,
  Tokens,
  Node,
} from '../typings/token.ts';
export class Lexer {
  private static code: string;

  private static lexing(): Token[] {
    let state: string = '';
    // Container variable contains processed tokens
    const container: Token[] = [];
    // Tmp variable contains temporary code chars that has been collected by tokenizer and which will be pushed to container
    const tmp: string[] = [];

    for (const char of this.code) {
      if (['(', ')', '{', '}'].includes(char) && state !== Tokens.String) {
        // Rechecking if tmp variable isn't empty before processing Node char
        if (tmp.length > 0) {
          state = '';
          container.push({ token: Tokens.Word, value: tmp.join('').trim() });
          tmp.splice(0, tmp.length);
        }
        container.push({ token: Tokens.Node, value: char as Node, });
      } else if (char === '"') {
        tmp.push(char);
        if (state === Tokens.String) {
          state = '';
          container.push({ token: Tokens.String, value: tmp.join('').trim() });
          tmp.splice(0, tmp.length);
        } else {
          state = Tokens.String;
        }
      } else if (char === ' ' && tmp.length > 0) {
        if (state === Tokens.String) {
          tmp.push(char);
        } else {
          state = '';
          container.push({ token: Tokens.Word, value: tmp.join('').trim() });
          tmp.splice(0, tmp.length);
        }
      } else {
        tmp.push(char);
      }
    }
    // Removing empty tokens from container
    return container.filter((token: Token) => token.value.length > 0);
  }

  public static tokenize(source: string): Token[] {
    // Formatting content
    this.code = source
      .split(/\r?\n/g)
      .map((line: string) => line.trim())
      .join('');
    return this.lexing();
  }
}
