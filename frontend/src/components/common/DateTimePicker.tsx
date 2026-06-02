"use client";

import { useState, useCallback, useMemo } from "react";
import { HiXMark } from "react-icons/hi2";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
  parse,
} from "date-fns";

/* ── types ── */
interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

/* ── helpers ── */
function strToDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(getHours(d))}:${pad(getMinutes(d))}`;
}

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/* ── component ── */
export default function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
  min: _min,
  max: _max,
  disabled,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => strToDate(value), [value]);

  /* calendar navigation */
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected || new Date()));
  const [timeInput, setTimeInput] = useState(() =>
    selected ? `${pad(getHours(selected))}:${pad(getMinutes(selected))}` : "12:00"
  );

  /* sync viewMonth on open */
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (o) {
        setViewMonth(startOfMonth(selected || new Date()));
        setTimeInput(selected ? `${pad(getHours(selected))}:${pad(getMinutes(selected))}` : "12:00");
      }
      setOpen(o);
    },
    [selected]
  );

  /* emit change */
  const emit = useCallback(
    (date: Date, time: string) => {
      const [h = "0", m = "0"] = time.split(":");
      const d = setMinutes(setHours(date, +h || 0), +m || 0);
      onChange(dateToStr(d));
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  const handleDayClick = useCallback(
    (day: Date) => {
      emit(day, timeInput);
      setOpen(false);
    },
    [timeInput, emit]
  );

  const handleTimeBlur = useCallback(() => {
    // validate HH:MM
    const m = /^(\d{1,2}):(\d{2})$/.exec(timeInput);
    let fixed = timeInput;
    if (!m) fixed = "12:00";
    else {
      const h = Math.min(23, Math.max(0, +m[1]));
      const mm = Math.min(59, Math.max(0, +m[2]));
      fixed = `${pad(h)}:${pad(mm)}`;
    }
    setTimeInput(fixed);
    if (selected) emit(selected, fixed);
  }, [timeInput, selected, emit]);

  /* calendar grid */
  const days = useMemo(() => {
    const s = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    const arr: Date[] = [];
    let cursor = s;
    while (cursor <= e) { arr.push(cursor); cursor = addDays(cursor, 1); }
    return arr;
  }, [viewMonth]);

  /* display text */
  const displayText = selected
    ? format(selected, "MMM d") + ", " + `${pad(getHours(selected))}:${pad(getMinutes(selected))}`
    : "";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal px-3 h-9",
            "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--hover-bg)]",
            !selected && "text-[var(--muted-foreground)]",
            className
          )}
        >
          <span className="truncate">{selected ? displayText : placeholder}</span>
          {selected && (
            <HiXMark
              className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer ml-1"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[280px] p-4 border-[var(--border)] bg-[var(--popover)] text-[var(--foreground)]"
      >
        {/* ── header ── */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="size-7 flex items-center justify-center rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)]"
          >
            ‹
          </button>
          <span className="text-sm font-medium select-none">
            {format(viewMonth, "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="size-7 flex items-center justify-center rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)]"
          >
            ›
          </button>
        </div>

        {/* ── day names ── */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((n) => (
            <div key={n} className="text-center text-[11px] text-[var(--muted-foreground)] py-1 select-none">
              {n}
            </div>
          ))}
        </div>

        {/* ── calendar grid ── */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = isSameMonth(day, viewMonth);
            const isSel = selected && isSameDay(day, selected);
            const isTdy = isToday(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDayClick(day)}
                className={cn(
                  "size-9 flex items-center justify-center text-sm rounded-full",
                  "hover:bg-[var(--hover-bg)] transition-colors",
                  !inMonth && "text-[var(--muted-foreground)]/40",
                  isSel && "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90",
                  isTdy && !isSel && "text-[var(--primary)] font-semibold"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        {/* ── divider ── */}
        <div className="my-3 border-t border-[var(--border)]" />

        {/* ── time input ── */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)] shrink-0">Time</span>
          <Input
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onBlur={handleTimeBlur}
            placeholder="HH:MM"
            className="h-8 w-20 text-sm border-[var(--border)] bg-[var(--background)] text-center"
          />
        </div>

        {/* ── footer ── */}
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const t = `${pad(getHours(now))}:${pad(getMinutes(now))}`;
              setTimeInput(t);
              emit(now, t);
              setOpen(false);
            }}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Today
          </button>
          {selected && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
