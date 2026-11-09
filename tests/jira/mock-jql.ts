export class JqlError extends Error {}

type Token = { type: "word" | "string" | "op" | "lparen" | "rparen" | "comma"; value: string };

type Operator = "=" | "!=" | "~" | "!~" | ">" | ">=" | "<" | "<=" | "in" | "not in" | "is" | "is not";

type Value = { kind: "literal"; value: string } | { kind: "function"; name: string; args: string[] } | { kind: "empty" };

type Node =
  | { type: "and" | "or"; nodes: Node[] }
  | { type: "not"; node: Node }
  | { type: "clause"; field: string; operator: Operator; values: Value[] };

export type JqlOrder = { field: string; direction: "asc" | "desc" }[];

export type ParsedJql = { where?: Node; orderBy: JqlOrder };

export type JqlField<T> = { values: (item: T) => readonly string[]; type?: "text" | "date" | "number" };

export type JqlSchema<T> = {
  fields: Record<string, JqlField<T>>;
  functions: Record<string, (args: string[]) => readonly string[]>;
  filter: (reference: string) => string | undefined;
  sort: Record<string, (item: T) => string | number | undefined>;
  defaultOrder: JqlOrder;
  now: () => number;
};

export type CompiledJql<T> = {
  matches: (item: T) => boolean;
  compare: (a: T, b: T) => number;
  ordered: boolean;
  dynamic: boolean;
};

const OPERATOR = /^(!=|>=|<=|!~|=|~|>|<)/;
const WORD = /^[^\s(),"'=!~<>]+/;
const RELATIVE = /^([+-]?\d+)([wdhm])$/i;
const UNIT_MS: Record<string, number> = { w: 604_800_000, d: 86_400_000, h: 3_600_000, m: 60_000 };
const DATE_FUNCTIONS = new Set(["now", "startofday", "endofday"]);
const MAX_FILTER_DEPTH = 5;

const tokenize = (input: string) => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === "(" || char === ")" || char === ",") {
      tokens.push({ type: char === "(" ? "lparen" : char === ")" ? "rparen" : "comma", value: char });
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      let value = "";
      index++;
      while (index < input.length && input[index] !== char) {
        if (input[index] === "\\") index++;
        value += input[index++] ?? "";
      }
      if (index >= input.length) throw new JqlError(`Error in the JQL Query: Unterminated string ${char}${value}`);
      index++;
      tokens.push({ type: "string", value });
      continue;
    }
    const rest = input.slice(index);
    const match = OPERATOR.exec(rest) ?? WORD.exec(rest);
    if (!match) throw new JqlError(`Error in the JQL Query: The character '${char}' is a reserved JQL character.`);
    tokens.push({ type: OPERATOR.test(rest) ? "op" : "word", value: match[0] });
    index += match[0].length;
  }
  return tokens;
};

export const parseJql = (input: string): ParsedJql => {
  const tokens = tokenize(input);
  let index = 0;
  const peek = () => tokens[index];
  const isWord = (token: Token | undefined, word: string) => token?.type === "word" && token.value.toLowerCase() === word;
  const unexpected = (token: Token | undefined, expected: string): never => {
    throw new JqlError(`Error in the JQL Query: Expecting ${expected} but got '${token?.value ?? "end of query"}'.`);
  };
  const expect = (type: Token["type"], expected: string) => {
    const token = tokens[index++];
    if (token?.type !== type) unexpected(token, expected);
  };

  const parseValue = (): Value => {
    const token = tokens[index++];
    if (!token || (token.type !== "word" && token.type !== "string")) return unexpected(token, "a value");
    if (token.type === "word" && /^(empty|null)$/i.test(token.value)) return { kind: "empty" };
    if (token.type === "word" && peek()?.type === "lparen") {
      index++;
      const args: string[] = [];
      while (peek()?.type !== "rparen") {
        const arg = tokens[index++];
        if (!arg || arg.type === "lparen") unexpected(arg, "')'");
        if (arg.type !== "comma") args.push(arg.value);
      }
      index++;
      return { kind: "function", name: token.value.toLowerCase(), args };
    }
    return { kind: "literal", value: token.value };
  };

  const parseOperator = (): Operator => {
    const token = tokens[index++];
    if (token?.type === "op") return token.value as Operator;
    if (isWord(token, "in")) return "in";
    if (isWord(token, "not") && isWord(peek(), "in")) {
      index++;
      return "not in";
    }
    if (isWord(token, "is")) {
      if (!isWord(peek(), "not")) return "is";
      index++;
      return "is not";
    }
    return unexpected(token, "an operator");
  };

  const parseClause = (): Node => {
    const field = tokens[index++];
    if (!field || (field.type !== "word" && field.type !== "string")) return unexpected(field, "a field name");
    const operator = parseOperator();
    if ((operator !== "in" && operator !== "not in") || peek()?.type !== "lparen") return { type: "clause", field: field.value, operator, values: [parseValue()] };
    expect("lparen", "'('");
    const values = [parseValue()];
    while (peek()?.type === "comma") {
      index++;
      values.push(parseValue());
    }
    expect("rparen", "')'");
    return { type: "clause", field: field.value, operator, values };
  };

  const parseUnary = (): Node => {
    if (isWord(peek(), "not")) {
      index++;
      return { type: "not", node: parseUnary() };
    }
    if (peek()?.type !== "lparen") return parseClause();
    index++;
    const node = parseOr();
    expect("rparen", "')'");
    return node;
  };

  const parseJoined = (word: "and" | "or", parseOperand: () => Node): Node => {
    const nodes = [parseOperand()];
    while (isWord(peek(), word)) {
      index++;
      nodes.push(parseOperand());
    }
    return nodes.length === 1 ? nodes[0] : { type: word, nodes };
  };
  const parseAnd = () => parseJoined("and", parseUnary);
  const parseOr = (): Node => parseJoined("or", parseAnd);

  const atOrderBy = () => isWord(peek(), "order") && isWord(tokens[index + 1], "by");
  const where = tokens.length === 0 || atOrderBy() ? undefined : parseOr();
  const orderBy: JqlOrder = [];
  if (atOrderBy()) {
    index += 2;
    do {
      if (orderBy.length > 0) index++;
      const field = tokens[index++];
      if (!field || (field.type !== "word" && field.type !== "string")) unexpected(field, "a field name");
      const direction = isWord(peek(), "asc") || isWord(peek(), "desc") ? tokens[index++].value.toLowerCase() : "asc";
      orderBy.push({ field: field.value, direction: direction as "asc" | "desc" });
    } while (peek()?.type === "comma");
  }
  if (index < tokens.length) unexpected(peek(), "'AND', 'OR' or 'ORDER BY'");
  return { where, orderBy };
};

const parseDate = (value: string, now: number) => {
  const relative = RELATIVE.exec(value.trim());
  if (relative) return now + Number(relative[1]) * UNIT_MS[relative[2].toLowerCase()];
  const local = /^(\d{4})[-/](\d{2})[-/](\d{2})(?: (\d{2}):(\d{2}))?$/.exec(value.trim());
  const time = local
    ? Date.UTC(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4] ?? 0), Number(local[5] ?? 0))
    : Date.parse(value);
  if (Number.isNaN(time)) throw new JqlError(`Date value '${value}' is invalid.`);
  return time;
};

const dayStart = (time: number) => time - (time % UNIT_MS.d);

const builtinDate = (name: string, args: string[], now: number) => {
  const offset = args[0] ? parseDate(args[0], 0) : 0;
  if (name === "now") return now;
  return name === "startofday" ? dayStart(now) + offset : dayStart(now) + UNIT_MS.d - 1 + offset;
};

export const compileJql = <T>(input: string, schema: JqlSchema<T>, depth = 0): CompiledJql<T> => {
  const { where, orderBy } = parseJql(input);
  let dynamic = false;

  const resolveValues = (values: Value[]) =>
    values.flatMap((value): (string | null)[] => {
      if (value.kind === "empty") return [null];
      if (value.kind === "literal") {
        if (RELATIVE.test(value.value)) dynamic = true;
        return [value.value];
      }
      if (DATE_FUNCTIONS.has(value.name)) {
        dynamic = true;
        return [new Date(builtinDate(value.name, value.args, schema.now())).toISOString()];
      }
      const fn = schema.functions[value.name];
      if (!fn) throw new JqlError(`Unable to find JQL function '${value.name}()'.`);
      return [...fn(value.args)];
    });

  const compileFilter = (operator: Operator, values: Value[]) => {
    if (depth >= MAX_FILTER_DEPTH) throw new JqlError("Filters reference each other too deeply.");
    const matchers = values.map((value) => {
      const reference = value.kind === "literal" ? value.value : "";
      const jql = schema.filter(reference);
      if (jql === undefined) throw new JqlError(`A value with ID '${reference}' does not exist for the field 'filter'.`);
      const compiled = compileJql(jql, schema, depth + 1);
      dynamic ||= compiled.dynamic;
      return compiled.matches;
    });
    if (operator === "=" || operator === "in") return (item: T) => matchers.some((matches) => matches(item));
    if (operator === "!=" || operator === "not in") return (item: T) => !matchers.some((matches) => matches(item));
    throw new JqlError(`The operator '${operator}' is not supported by the 'filter' field.`);
  };

  const compileClause = (node: Extract<Node, { type: "clause" }>): ((item: T) => boolean) => {
    const name = node.field.toLowerCase();
    if (name === "filter" || name === "savedfilter" || name === "request") return compileFilter(node.operator, node.values);
    const field = schema.fields[name];
    if (!field) throw new JqlError(`Field '${node.field}' does not exist or you do not have permission to view it.`);
    const values = resolveValues(node.values);
    const tokens = (item: T) => field.values(item).map((token) => token.toLowerCase());
    const raw = values.filter((value): value is string => value !== null);
    const literals = raw.map((value) => value.toLowerCase());
    const includesEmpty = values.includes(null);
    switch (node.operator) {
      case "is":
      case "is not": {
        if (!includesEmpty) throw new JqlError(`The operator '${node.operator}' only supports EMPTY or NULL.`);
        const wantsEmpty = node.operator === "is";
        return (item) => (field.values(item).length === 0) === wantsEmpty;
      }
      case "=":
      case "in": {
        const sameDay = field.type === "date";
        return (item) => {
          const own = tokens(item);
          if (own.length === 0) return includesEmpty;
          return own.some((token) => literals.some((literal) => (sameDay ? token.startsWith(literal) : token === literal)));
        };
      }
      case "!=":
      case "not in":
        return (item) => {
          const own = tokens(item);
          return own.length > 0 && !own.some((token) => literals.includes(token));
        };
      case "~":
      case "!~": {
        const needle = (literals[0] ?? "").replaceAll("*", "");
        const contains = (item: T) => tokens(item).some((token) => token.includes(needle));
        return node.operator === "~" ? contains : (item) => !contains(item);
      }
      default: {
        if (field.type !== "date" && field.type !== "number") {
          throw new JqlError(`The operator '${node.operator}' is not supported by the '${node.field}' field.`);
        }
        const toNumber = (value: string) => (field.type === "date" ? parseDate(value, schema.now()) : Number(value));
        const bound = toNumber(raw[0] ?? "");
        const compare = {
          ">": (value: number) => value > bound,
          ">=": (value: number) => value >= bound,
          "<": (value: number) => value < bound,
          "<=": (value: number) => value <= bound,
        }[node.operator];
        return (item) => field.values(item).some((token) => compare(toNumber(token)));
      }
    }
  };

  const compileNode = (node: Node): ((item: T) => boolean) => {
    if (node.type === "clause") return compileClause(node);
    if (node.type === "not") {
      const inner = compileNode(node.node);
      return (item) => !inner(item);
    }
    const parts = node.nodes.map(compileNode);
    return node.type === "and" ? (item) => parts.every((part) => part(item)) : (item) => parts.some((part) => part(item));
  };

  const order = (orderBy.length > 0 ? orderBy : schema.defaultOrder).map(({ field, direction }) => {
    const key = schema.sort[field.toLowerCase()];
    if (!key) throw new JqlError(`Not able to sort using field '${field}'.`);
    return { key, sign: direction === "desc" ? -1 : 1 };
  });

  const compare = (a: T, b: T) => {
    for (const { key, sign } of order) {
      const left = key(a);
      const right = key(b);
      if (left === right) continue;
      if (left === undefined) return 1;
      if (right === undefined) return -1;
      return left < right ? -sign : sign;
    }
    return 0;
  };

  return { matches: where ? compileNode(where) : () => true, compare, ordered: orderBy.length > 0, dynamic };
};
