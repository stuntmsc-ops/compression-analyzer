"use client";

import Select from "./Select";
import {
  INSTRUMENT_OPTIONS,
  GENRE_OPTIONS,
  GOAL_OPTIONS,
  type SelectorState,
} from "@/lib/types";

type SelectorPanelProps = {
  value: SelectorState;
  onChange: (value: SelectorState) => void;
};

export default function SelectorPanel({ value, onChange }: SelectorPanelProps) {
  const activeGoal = GOAL_OPTIONS.find((g) => g.value === value.goal);

  return (
    <div className="max-w-2xl mx-auto mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Select
          label="Instrument"
          value={value.instrument}
          options={INSTRUMENT_OPTIONS}
          onChange={(instrument) => onChange({ ...value, instrument })}
        />
        <Select
          label="Genre"
          value={value.genre}
          options={GENRE_OPTIONS}
          onChange={(genre) => onChange({ ...value, genre })}
        />
        <Select
          label="Goal"
          value={value.goal}
          options={GOAL_OPTIONS}
          onChange={(goal) => onChange({ ...value, goal })}
        />
      </div>

      {activeGoal && (
        <p className="text-gray-500 text-xs mt-2.5 px-1 text-left">
          <span className="text-gray-400">{activeGoal.label}:</span>{" "}
          {activeGoal.description}
        </p>
      )}
    </div>
  );
}
