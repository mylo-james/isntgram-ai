"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({
  initialQuery = "",
  placeholder = "Search users or #hashtags",
}: {
  initialQuery?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const trimmed = useMemo(() => value.trim(), [value]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full items-center gap-2">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        id="search"
        name="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="submit"
        disabled={!trimmed}
        className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Search
      </button>
    </form>
  );
}
