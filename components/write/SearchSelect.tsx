"use client";

import { useId, useState, type ReactNode } from "react";

// A type-to-search picker. Results come from a plain function over data that's
// already in the browser, so typing never makes a network request.
export default function SearchSelect<T>({
  label,
  placeholder,
  hint,
  value,
  onChange,
  search,
  getKey,
  renderOption,
  renderSelected,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  value: T | null;
  onChange: (next: T | null) => void;
  search: (query: string) => T[];
  getKey: (item: T) => string | number;
  renderOption: (item: T) => ReactNode;
  renderSelected: (item: T) => ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = open ? search(query) : [];

  function choose(item: T) {
    onChange(item);
    setQuery("");
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {label}
      </label>

      {value ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-navy/30 bg-badge px-3 py-2.5">
          <div className="min-w-0 text-sm text-navy">{renderSelected(value)}</div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex-none text-xs font-semibold text-navylight underline-offset-2 hover:text-navy hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative mt-2">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            value={query}
            placeholder={disabled ? "Loading…" : placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy disabled:bg-gray-50"
          />

          {open && query.trim() !== "" && (
            <ul
              id={`${id}-list`}
              role="listbox"
              className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            >
              {results.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-navymuted">No matches</li>
              ) : (
                results.map((item, i) => (
                  <li
                    key={getKey(item)}
                    role="option"
                    aria-selected={i === active}
                    // mousedown (not click) so it fires before the input's blur
                    // closes the list.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(item);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      i === active ? "bg-badge text-navy" : "text-gray-800"
                    }`}
                  >
                    {renderOption(item)}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {hint && !value && <p className="mt-1.5 text-xs text-navymuted">{hint}</p>}
    </div>
  );
}
