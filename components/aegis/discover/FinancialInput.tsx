"use client";

import type { ReactNode } from "react";

const labelClass =
  "text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70";
const fieldClass =
  "w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/40 focus:bg-[#071B2A]/70";
const hintClass = "text-xs font-light text-[#F3F1EA]/35";

interface BaseFieldProps {
  label: string;
  hint?: string;
  id: string;
}

interface TextInputProps extends BaseFieldProps {
  type?: "text" | "number";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}

export function FinancialTextInput({
  label,
  hint,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  prefix,
}: TextInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#F3F1EA]/40">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={`${fieldClass} ${prefix ? "pl-9" : ""}`}
        />
      </div>
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function FinancialSelect({
  label,
  hint,
  id,
  value,
  onChange,
  options,
  placeholder,
}: SelectInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} cursor-pointer appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23D1A866' stroke-opacity='0.5' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#10283A]">
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

interface CheckboxInputProps extends BaseFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export function FinancialCheckbox({
  label,
  hint,
  id,
  checked,
  onChange,
  description,
}: CheckboxInputProps) {
  return (
    <label
      htmlFor={id}
      className="group flex cursor-pointer items-start gap-3 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/30 p-4 transition-colors hover:border-[#D1A866]/20 hover:bg-[#071B2A]/50"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-[#D1A866]/30 bg-[#10283A] accent-[#D1A866]"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-light text-[#F3F1EA]">{label}</span>
        {description && (
          <span className="text-xs font-light text-[#F3F1EA]/40">{description}</span>
        )}
        {hint && <span className={hintClass}>{hint}</span>}
      </div>
    </label>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">{children}</div>
  );
}

export function FieldStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}
