"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";

/* ============================================================================
   Helper Functions
   ============================================================================ */

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function formatToDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseInputDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/* ============================================================================
   DatePicker Component
   ============================================================================ */

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  disabled?: boolean;
  required?: boolean;
  max?: string; // YYYY-MM-DD
  className?: string;
  placeholder?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  required = false,
  max,
  className = "",
  placeholder = "dd/mm/aaaa",
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parsed selected date
  const selectedDate = useMemo(() => parseInputDate(value), [value]);

  // Current view month & year
  const [viewDate, setViewDate] = useState(() => {
    return selectedDate || new Date();
  });

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Reset view to selected date when popover opens
  useEffect(() => {
    if (isOpen && selectedDate) {
      setViewDate(selectedDate);
    }
  }, [isOpen, selectedDate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Apenas permite números e barras
    val = val.replace(/[^0-9/]/g, "");

    // Máscara automática de DD/MM/AAAA conforme digita
    if (val.length === 2 && !val.includes("/")) {
      val = val + "/";
    } else if (val.length === 5 && val.split("/").length === 2) {
      val = val + "/";
    }

    // Limita o tamanho máximo a 10 caracteres
    if (val.length > 10) {
      val = val.slice(0, 10);
    }

    setInputValue(val);

    // Se completou 10 caracteres (DD/MM/AAAA), valida
    if (val.length === 10) {
      const parts = val.split("/");
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);

        const dateObj = new Date(y, m, d);
        if (
          !isNaN(dateObj.getTime()) &&
          dateObj.getDate() === d &&
          dateObj.getMonth() === m &&
          dateObj.getFullYear() === y
        ) {
          const isoDate = formatToDateInput(dateObj); // YYYY-MM-DD
          onChange(isoDate);
          setViewDate(dateObj); // Atualiza visualização do calendário para o mês correspondente
        }
      }
    }
  };

  const handleInputBlur = () => {
    if (!inputValue) {
      onChange("");
      return;
    }

    const parts = inputValue.split("/");
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);

      const dateObj = new Date(y, m, d);
      if (
        !isNaN(dateObj.getTime()) &&
        dateObj.getDate() === d &&
        dateObj.getMonth() === m &&
        dateObj.getFullYear() === y
      ) {
        const isoDate = formatToDateInput(dateObj);
        onChange(isoDate);
        setViewDate(dateObj);
        setInputValue(inputValue);
        return;
      }
    }

    // Se a data for inválida, restaura o valor original
    setInputValue(displayValue);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Max date parsing
  const maxDateLimit = useMemo(() => (max ? parseInputDate(max) : null), [max]);

  // Date formatting for trigger display (DD/MM/AAAA)
  const displayValue = useMemo(() => {
    if (!selectedDate) return "";
    const d = String(selectedDate.getDate()).padStart(2, "0");
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const y = selectedDate.getFullYear();
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  // Text input value state
  const [inputValue, setInputValue] = useState("");

  // Sync display value when it changes from outside
  useEffect(() => {
    setInputValue(displayValue);
  }, [displayValue]);

  // Generate calendar cells
  const cells = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const items = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      items.push({ day: null, dateStr: "", disabled: true });
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(viewYear, viewMonth, day);
      const dateStr = formatToDateInput(dateObj);
      let isCellDisabled = false;

      if (maxDateLimit) {
        // Compare dates at midnight
        const tempMax = new Date(maxDateLimit.getFullYear(), maxDateLimit.getMonth(), maxDateLimit.getDate());
        const tempCell = new Date(viewYear, viewMonth, day);
        isCellDisabled = tempCell > tempMax;
      }

      items.push({
        day,
        dateStr,
        disabled: isCellDisabled,
        isToday: formatToDateInput(new Date()) === dateStr,
        isSelected: value === dateStr,
      });
    }

    return items;
  }, [viewYear, viewMonth, maxDateLimit, value]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const todayStr = formatToDateInput(new Date());
    if (maxDateLimit) {
      const todayObj = new Date();
      const tempMax = new Date(maxDateLimit.getFullYear(), maxDateLimit.getMonth(), maxDateLimit.getDate());
      if (todayObj > tempMax) {
        // If today is beyond max, select the max date instead
        if (max) {
          onChange(max);
        }
        setIsOpen(false);
        return;
      }
    }
    onChange(todayStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  // Year choices (last 10 years and next 10 years)
  const years = useMemo(() => {
    const currentY = new Date().getFullYear();
    const list = [];
    for (let y = currentY - 80; y <= currentY + 10; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewDate(new Date(parseInt(e.target.value, 10), viewMonth, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewDate(new Date(viewYear, parseInt(e.target.value, 10), 1));
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Field */}
      <div className="relative w-full">
        <input
          type="text"
          id={id}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 pr-10 ${className}`}
          autoComplete="off"
        />
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-slate-655 transition-colors"
        >
          <CalendarIcon className="h-4.5 w-4.5 shrink-0" />
        </div>
      </div>

      {/* Hidden input to satisfy "required" form validation */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          className="absolute inset-0 -z-10 h-0 w-0 opacity-0 pointer-events-none"
          required
        />
      )}

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 z-[9999] w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Month Select */}
              <select
                value={viewMonth}
                onChange={handleMonthChange}
                className="rounded-lg bg-slate-50 border-0 px-2 py-1 text-sm font-semibold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Year Select */}
              <select
                value={viewYear}
                onChange={handleYearChange}
                className="rounded-lg bg-slate-50 border-0 px-2 py-1 text-sm font-semibold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((day, idx) => (
              <span key={`wd-${idx}`} className="text-xs font-semibold text-slate-400 py-1">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (cell.day === null) {
                return <div key={`empty-${idx}`} />;
              }

              return (
                <button
                  key={`day-${cell.dateStr}`}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => handleSelectDay(cell.dateStr)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    cell.isSelected
                      ? "bg-primary text-white font-semibold shadow-sm"
                      : cell.disabled
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cell.day}
                  {cell.isToday && !cell.isSelected && (
                    <span className={`absolute bottom-1 h-1 w-1 rounded-full ${cell.isSelected ? "bg-white" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-slate-100" />

          {/* Footer Actions */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className="font-bold text-primary hover:text-primary-dark transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TimePicker Component
   ============================================================================ */

interface TimePickerProps {
  value: string; // HH:MM
  onChange: (val: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
}

export function TimePicker({
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  placeholder = "--:--",
  id,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Parse hour and minute from value
  const { hour, minute } = useMemo(() => {
    if (!value) return { hour: "", minute: "" };
    const parts = value.split(":");
    return {
      hour: parts[0] || "",
      minute: parts[1] || "",
    };
  }, [value]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Hours array (00 to 23)
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  }, []);

  // Minutes array (00 to 59)
  const minutes = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  }, []);

  // Center selected items on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hour && hourListRef.current) {
          const selectedHourEl = hourListRef.current.querySelector(`[data-hour="${hour}"]`);
          if (selectedHourEl) {
            selectedHourEl.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }
        if (minute && minuteListRef.current) {
          const selectedMinuteEl = minuteListRef.current.querySelector(`[data-minute="${minute}"]`);
          if (selectedMinuteEl) {
            selectedMinuteEl.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }
      }, 50);
    }
  }, [isOpen, hour, minute]);

  const selectHour = (h: string) => {
    const nextMinute = minute || "00";
    onChange(`${h}:${nextMinute}`);
  };

  const selectMinute = (m: string) => {
    const nextHour = hour || "12";
    onChange(`${nextHour}:${m}`);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const handleConfirm = () => {
    // If no values selected, set to default 12:00
    if (!hour && !minute) {
      onChange("12:00");
    } else {
      const h = hour || "12";
      const m = minute || "00";
      onChange(`${h}:${m}`);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Field */}
      <div className="relative w-full">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
          <span className={value ? "text-slate-800" : "text-slate-400"}>
            {value || placeholder}
          </span>
          <Clock className="h-4.5 w-4.5 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Hidden input to satisfy "required" form validation */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          className="absolute inset-0 -z-10 h-0 w-0 opacity-0 pointer-events-none"
          required
        />
      )}

      {/* Time Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 z-[9999] w-[240px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold text-slate-400 mb-1 border-b border-slate-50 pb-1">
            <div>Horas</div>
            <div>Minutos</div>
          </div>

          <div className="flex h-48 gap-2">
            {/* Hours Column */}
            <div
              ref={hourListRef}
              className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent rounded-lg border border-slate-100 bg-slate-50 p-1"
            >
              <div className="space-y-0.5">
                {hours.map((h) => {
                  const isSelected = hour === h;
                  return (
                    <button
                      key={`h-${h}`}
                      type="button"
                      data-hour={h}
                      onClick={() => selectHour(h)}
                      className={`w-full rounded-md py-1.5 text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-white font-semibold"
                          : "text-slate-700 hover:bg-slate-200/60"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Column */}
            <div
              ref={minuteListRef}
              className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent rounded-lg border border-slate-100 bg-slate-50 p-1"
            >
              <div className="space-y-0.5">
                {minutes.map((m) => {
                  const isSelected = minute === m;
                  return (
                    <button
                      key={`m-${m}`}
                      type="button"
                      data-minute={m}
                      onClick={() => selectMinute(m)}
                      className={`w-full rounded-md py-1.5 text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-white font-semibold"
                          : "text-slate-700 hover:bg-slate-200/60"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-slate-100" />

          {/* Actions */}
          <div className="flex items-center justify-between px-1 text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="font-bold text-primary hover:text-primary-dark transition-colors py-1 px-3 rounded-lg hover:bg-primary/5"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
