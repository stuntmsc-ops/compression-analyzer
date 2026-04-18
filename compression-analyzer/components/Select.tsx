"use client";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  hint?: string;
};

export default function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectProps<T>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none bg-surface-800 border border-surface-600 hover:border-surface-500 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-800 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {hint && <span className="text-xs text-gray-600">{hint}</span>}
    </label>
  );
}
