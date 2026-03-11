"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SymbolProfile } from "@/lib/types";

interface SearchBoxProps {
  placeholder?: string;
}

export function SearchBox({ placeholder = "종목명 또는 코드 검색" }: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolProfile[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/symbols/search?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal
          }
        );
        const payload = (await response.json()) as { items: SymbolProfile[] };
        setResults(payload.items);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function handlePick(item: SymbolProfile) {
    setOpen(false);
    setQuery("");
    router.push(`/stocks/${item.market.toLowerCase()}/${item.symbol.toLowerCase()}`);
  }

  return (
    <div className="search-box">
      <input
        aria-label="종목 검색"
        className="search-input"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        value={query}
      />
      {open && results.length > 0 ? (
        <div className="search-panel">
          {results.map((item) => (
            <button
              className="search-item"
              key={`${item.market}-${item.symbol}`}
              onClick={() => handlePick(item)}
              type="button"
            >
              <span>
                <strong>{item.name}</strong>
                <span className="search-subline">
                  {item.symbol} · {item.exchange}
                </span>
              </span>
              <span className={item.changePct >= 0 ? "up" : "down"}>
                {item.changePct >= 0 ? "+" : ""}
                {item.changePct.toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
