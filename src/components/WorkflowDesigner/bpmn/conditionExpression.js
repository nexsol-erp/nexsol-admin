// Builds/parses the SpEL condition expressions SimpleBpmnParser's Expr.evalLogical()
// actually evaluates (see e:\workflow\src\main\java\com\miniflow\core\Expr.java): a bare
// variable name like `lab` gets rewritten to map access (`['lab']`) at eval time, wrapped in
// `={...}` — exactly the format already used in the HIMS.bpmn sample (`={lab == true}`).

export const OPERATORS = [
  { key: "eq", label: "Equals", needsValue: true, build: (v, val) => `${v} == ${val}` },
  { key: "neq", label: "Not equals", needsValue: true, build: (v, val) => `${v} != ${val}` },
  { key: "gt", label: "Greater than", needsValue: true, build: (v, val) => `${v} > ${val}` },
  { key: "gte", label: "Greater than or equal", needsValue: true, build: (v, val) => `${v} >= ${val}` },
  { key: "lt", label: "Less than", needsValue: true, build: (v, val) => `${v} < ${val}` },
  { key: "lte", label: "Less than or equal", needsValue: true, build: (v, val) => `${v} <= ${val}` },
  { key: "contains", label: "Contains", needsValue: true, build: (v, val) => `${v}.contains(${val})` },
  { key: "empty", label: "Is empty", needsValue: false, build: (v) => `${v} == null or ${v} == ''` },
  { key: "notEmpty", label: "Is not empty", needsValue: false, build: (v) => `${v} != null and ${v} != ''` },
  {
    key: "in",
    label: "In list",
    needsValue: true,
    build: (v, _val, rawValue) => {
      const items = String(rawValue || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `'${s.replace(/'/g, "\\'")}'`)
        .join(",");
      return `{${items}}.contains(${v})`;
    },
  },
];

export const VALUE_TYPES = [
  { key: "string", label: "String" },
  { key: "number", label: "Number" },
  { key: "boolean", label: "Boolean" },
];

function quoteValue(value, valueType) {
  if (valueType === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "0";
  }
  if (valueType === "boolean") {
    return value === "true" ? "true" : "false";
  }
  return `'${String(value ?? "").replace(/'/g, "\\'")}'`;
}

export function buildExpression(variable, operatorKey, value, valueType) {
  const v = (variable || "").trim();
  if (!v) return "";
  const op = OPERATORS.find((o) => o.key === operatorKey) || OPERATORS[0];
  const formatted = quoteValue(value, valueType);
  const body = op.build(v, formatted, value, valueType);
  return `={${body}}`;
}

function unquote(raw) {
  const s = raw.trim();
  const strMatch = s.match(/^'(.*)'$/);
  if (strMatch) return { value: strMatch[1].replace(/\\'/g, "'"), valueType: "string" };
  if (s === "true" || s === "false") return { value: s, valueType: "boolean" };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { value: s, valueType: "number" };
  return { value: s, valueType: "string" };
}

/**
 * Best-effort parse of an existing condition body back into structured fields, so the
 * builder can prefill from expressions it (or a raw edit) already wrote. Returns null for
 * anything it doesn't recognize — the raw "Condition expression" field bpmn-js-properties-
 * panel already ships stays available as the fallback for those.
 */
export function parseExpression(body) {
  if (!body) return null;
  const wrapped = body.trim().match(/^(?:=|\$|#)\{([\s\S]*)\}$/);
  if (!wrapped) return null;
  const inner = wrapped[1].trim();

  const emptyMatch = inner.match(/^(\w+)\s*==\s*null\s+or\s+\1\s*==\s*''$/);
  if (emptyMatch) return { variable: emptyMatch[1], operator: "empty", value: "", valueType: "string" };

  const notEmptyMatch = inner.match(/^(\w+)\s*!=\s*null\s+and\s+\1\s*!=\s*''$/);
  if (notEmptyMatch) return { variable: notEmptyMatch[1], operator: "notEmpty", value: "", valueType: "string" };

  const containsMatch = inner.match(/^(\w+)\.contains\((.+)\)$/);
  if (containsMatch) {
    const { value, valueType } = unquote(containsMatch[2]);
    return { variable: containsMatch[1], operator: "contains", value, valueType };
  }

  const inMatch = inner.match(/^\{(.*)\}\.contains\((\w+)\)$/);
  if (inMatch) {
    const items = inMatch[1]
      .split(",")
      .map((s) => unquote(s.trim()).value)
      .join(", ");
    return { variable: inMatch[2], operator: "in", value: items, valueType: "string" };
  }

  const binMap = { "==": "eq", "!=": "neq", ">=": "gte", "<=": "lte", ">": "gt", "<": "lt" };
  const binMatch = inner.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (binMatch) {
    const [, variable, opSym, rawVal] = binMatch;
    const { value, valueType } = unquote(rawVal.trim());
    return { variable, operator: binMap[opSym], value, valueType };
  }

  return null;
}
