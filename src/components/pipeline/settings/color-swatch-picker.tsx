"use client";

const PRESET_COLORS = ["#64748b", "#2563eb", "#0891b2", "#16a34a", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#7c3aed"];

export function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`size-6 rounded-full ring-2 ring-offset-2 ring-offset-background transition ${
            value.toLowerCase() === color.toLowerCase() ? "ring-foreground" : "ring-transparent"
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
        title="Custom color"
      />
    </div>
  );
}
