"use client";

/**
 * FormulaBuilder — Asana-style multi-term expression editor for a FORMULA
 * field. Tokens alternate operand · operator · operand … where an operand
 * is a project field OR a constant number. The engine (src/lib/formula-eval)
 * evaluates with standard precedence (× ÷ before + −). Date fields count as
 * whole days so date − date = a day difference.
 */

import { X } from "lucide-react";

export type Token =
  | { t: "field"; id: string }
  | { t: "num"; n: number }
  | { t: "op"; op: "+" | "-" | "*" | "/" };

export interface FieldOpt {
  id: string;
  name: string;
  type: string;
}

const OP_LABEL: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/** A complete, evaluable expression: odd length; every operand set. */
export function isExprComplete(tokens: Token[]): boolean {
  if (tokens.length === 0 || tokens.length % 2 === 0) return false;
  return tokens.every((tk, i) => {
    if (i % 2 === 0) {
      if (tk.t === "field") return tk.id !== "";
      if (tk.t === "num") return Number.isFinite(tk.n);
      return false;
    }
    return tk.t === "op";
  });
}

const inputClass =
  "h-8 px-2 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black/10";

function OperandInput({
  fields,
  token,
  onChange,
}: {
  fields: FieldOpt[];
  token: Token;
  onChange: (t: Token) => void;
}) {
  const isNum = token.t === "num";
  const selectValue = isNum
    ? "__num__"
    : token.t === "field" && token.id
      ? `field:${token.id}`
      : "";
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__num__")
            onChange({ t: "num", n: isNum ? (token as { n: number }).n : 0 });
          else if (v.startsWith("field:"))
            onChange({ t: "field", id: v.slice(6) });
          else onChange({ t: "field", id: "" });
        }}
        className={inputClass}
      >
        <option value="">Field…</option>
        {fields.map((f) => (
          <option key={f.id} value={`field:${f.id}`}>
            {f.name}
          </option>
        ))}
        <option value="__num__">123 Number…</option>
      </select>
      {isNum && (
        <input
          type="number"
          value={(token as { n: number }).n}
          onChange={(e) => onChange({ t: "num", n: Number(e.target.value) })}
          className={`${inputClass} w-16 tabular-nums`}
        />
      )}
    </span>
  );
}

export function FormulaBuilder({
  fields,
  tokens,
  onChange,
}: {
  fields: FieldOpt[];
  tokens: Token[];
  onChange: (t: Token[]) => void;
}) {
  const toks: Token[] = tokens.length ? tokens : [{ t: "field", id: "" }];

  const setAt = (i: number, tk: Token) => {
    const c = [...toks];
    c[i] = tk;
    onChange(c);
  };
  const addTerm = () =>
    onChange([...toks, { t: "op", op: "+" }, { t: "field", id: "" }]);
  const removeTerm = () => {
    if (toks.length >= 3) onChange(toks.slice(0, -2));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {toks.map((tk, i) =>
        i % 2 === 0 ? (
          <OperandInput
            key={i}
            fields={fields}
            token={tk}
            onChange={(t) => setAt(i, t)}
          />
        ) : (
          <select
            key={i}
            value={tk.t === "op" ? tk.op : "+"}
            onChange={(e) =>
              setAt(i, {
                t: "op",
                op: e.target.value as "+" | "-" | "*" | "/",
              })
            }
            className={`${inputClass} w-14 text-center`}
          >
            {(["+", "-", "*", "/"] as const).map((o) => (
              <option key={o} value={o}>
                {OP_LABEL[o]}
              </option>
            ))}
          </select>
        )
      )}
      <button
        type="button"
        onClick={addTerm}
        className="h-8 px-2 text-[12px] text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
      >
        + term
      </button>
      {toks.length >= 3 && (
        <button
          type="button"
          onClick={removeTerm}
          title="Remove last term"
          className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
