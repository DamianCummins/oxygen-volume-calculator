import { useState, useMemo } from "react";

const FULL_CAPACITY_LITERS = 772;  // 490 L scaled to 315 Bar
const FULL_PRESSURE_BAR = 315;
const FULL_PRESSURE_PSI = 4568;   // 315 × 14.5
const WARNING_MINUTES = 30;
const WARNING_BAR = 50;

type Unit = "Bar" | "PSI";

function psiToBar(psi: number): number {
  return psi / 14.5;
}
function barToPsi(bar: number): number {
  return bar * 14.5;
}

/** Format total minutes as "X hours Y minutes" or "Y minutes" */
function formatTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  if (h === 0) return `${m} minute${m !== 1 ? "s" : ""}`;
  return `${h} hour${h !== 1 ? "s" : ""} ${m} minute${m !== 1 ? "s" : ""}`;
}

// ──────────────────────────────────────────────────
// SVG helpers
// ──────────────────────────────────────────────────

/**
 * Gauge angles (SVG: 0° = right/3 o'clock, clockwise positive)
 *   7 o'clock (bottom-left, 0 bar)  → 120°
 *   5 o'clock (bottom-right, 200 bar) → 420° = 60° (mod 360)
 *   Total clockwise sweep = 300°
 */
const GAUGE_START_DEG = 120;
const GAUGE_SWEEP_DEG = 300;

function barToDeg(bar: number): number {
  return GAUGE_START_DEG + (bar / FULL_PRESSURE_BAR) * GAUGE_SWEEP_DEG;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number
): string {
  const start = polar(cx, cy, r, fromDeg);
  const end = polar(cx, cy, r, toDeg);
  // Normalise sweep to [0, 360)
  let sweep = ((toDeg - fromDeg) % 360 + 360) % 360;
  if (sweep === 0) sweep = 360;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// ──────────────────────────────────────────────────
// Gauge component
// ──────────────────────────────────────────────────

function PressureGauge({
  pressureBar,
  unit,
}: {
  pressureBar: number;
  unit: Unit;
}) {
  const cx = 150;
  const cy = 150;
  const outerR = 138; // bezel outer edge
  const faceR = 128;  // white face
  const arcR = 112;   // coloured zone track (centre of stroke)
  const arcStroke = 18;
  const tickOuter = 100; // tick outer end
  const majorTickLen = 14;
  const minorTickLen = 7;
  const labelR = 80;  // number labels

  const clampedBar = Math.min(Math.max(pressureBar, 0), FULL_PRESSURE_BAR);

  // Zone arc end angles
  const redEndDeg   = barToDeg(50);
  const yldEndDeg   = barToDeg(100);
  const lgrnEndDeg  = barToDeg(200);
  const dgrnEndDeg  = barToDeg(230);
  const whtEndDeg   = barToDeg(315);

  // Needle
  const needleDeg = barToDeg(clampedBar);
  const needleLen = 78;
  const needleTip = polar(cx, cy, needleLen, needleDeg);
  const baseHalf = 7;
  const perpDeg = needleDeg + 90;
  const base1 = polar(cx, cy, baseHalf, perpDeg);
  const base2 = polar(cx, cy, baseHalf, perpDeg + 180);
  const tailTip = polar(cx, cy, 18, needleDeg + 180);

  let needleColor = "#16a34a";
  if (clampedBar <= 50)       needleColor = "#dc2626";
  else if (clampedBar <= 100) needleColor = "#d97706";
  else if (clampedBar <= 200) needleColor = "#16a34a";
  else if (clampedBar <= 230) needleColor = "#15803d";
  else                        needleColor = "#1e40af";

  // Tick marks — major every 50 Bar + 315 at end; minor every 5 Bar
  const ticks: {
    x1: number; y1: number; x2: number; y2: number;
    isMajor: boolean;
    label: string | null; lx: number; ly: number;
  }[] = [];
  const majorBars = [0, 50, 100, 150, 200, 250, 300, 315];
  const stepBar = 5;
  for (let bar = 0; bar <= FULL_PRESSURE_BAR; bar += stepBar) {
    const deg = barToDeg(bar);
    const isMajor = majorBars.includes(bar);
    const len = isMajor ? majorTickLen : minorTickLen;
    const inner = polar(cx, cy, tickOuter - len, deg);
    const outer = polar(cx, cy, tickOuter, deg);
    let label: string | null = null;
    if (isMajor) {
      label = unit === "Bar"
        ? String(bar)
        : String(Math.round(barToPsi(bar)));
    }
    const lp = polar(cx, cy, labelR, deg);
    ticks.push({
      x1: inner.x, y1: inner.y,
      x2: outer.x, y2: outer.y,
      isMajor,
      label,
      lx: lp.x, ly: lp.y,
    });
  }

  const centerLabel =
    unit === "Bar"
      ? `${Math.round(clampedBar)}`
      : `${Math.round(barToPsi(clampedBar))}`;

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full max-w-[320px] drop-shadow-md"
      aria-label="Oxygen tank pressure gauge"
    >
      {/* Bezel */}
      <circle cx={cx} cy={cy} r={outerR} fill="#c8c8c8" />
      <circle cx={cx} cy={cy} r={outerR - 4} fill="#e8e8e8" />

      {/* White face */}
      <circle cx={cx} cy={cy} r={faceR} fill="white" />

      {/* ── Coloured zone arcs (outer ring on face) ── */}
      {/* Background track */}
      <path
        d={arcPath(cx, cy, arcR, GAUGE_START_DEG, whtEndDeg)}
        fill="none"
        stroke="#e2e2e2"
        strokeWidth={arcStroke}
        strokeLinecap="butt"
      />
      {/* Red: 0 → 50 Bar */}
      <path
        d={arcPath(cx, cy, arcR, GAUGE_START_DEG, redEndDeg)}
        fill="none"
        stroke="#ef4444"
        strokeWidth={arcStroke}
        strokeLinecap="butt"
      />
      {/* Yellow: 50 → 100 Bar */}
      <path
        d={arcPath(cx, cy, arcR, redEndDeg, yldEndDeg)}
        fill="none"
        stroke="#facc15"
        strokeWidth={arcStroke}
        strokeLinecap="butt"
      />
      {/* Light green: 100 → 200 Bar */}
      <path
        d={arcPath(cx, cy, arcR, yldEndDeg, lgrnEndDeg)}
        fill="none"
        stroke="#4ade80"
        strokeWidth={arcStroke}
        strokeLinecap="butt"
      />
      {/* Dark green: 200 → 230 Bar */}
      <path
        d={arcPath(cx, cy, arcR, lgrnEndDeg, dgrnEndDeg)}
        fill="none"
        stroke="#15803d"
        strokeWidth={arcStroke}
        strokeLinecap="butt"
      />
      {/* White: 230 → 315 Bar (light grey so visible on white face) */}
      <path
        d={arcPath(cx, cy, arcR, dgrnEndDeg, whtEndDeg)}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={arcStroke}
        strokeLinecap="butt"
      />

      {/* ── Tick marks ── */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1}
          x2={t.x2} y2={t.y2}
          stroke={t.isMajor ? "#1e293b" : "#6b7280"}
          strokeWidth={t.isMajor ? 2 : 1}
        />
      ))}

      {/* ── Tick labels ── */}
      {ticks
        .filter((t) => t.label !== null)
        .map((t, i) => (
          <text
            key={i}
            x={t.lx}
            y={t.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="700"
            fill="#1e293b"
            fontFamily="system-ui, sans-serif"
          >
            {t.label}
          </text>
        ))}

      {/* ── Centre decoration ── */}
      {/* Unit label */}
      <text
        x={cx}
        y={cy - 22}
        textAnchor="middle"
        fontSize="9"
        fill="#64748b"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="0.12em"
      >
        {unit.toUpperCase()}
      </text>

      {/* Large pressure readout */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize="26"
        fontWeight="800"
        fill={needleColor}
        fontFamily="system-ui, sans-serif"
        style={{ transition: "fill 0.3s ease" }}
      >
        {centerLabel}
      </text>

      {/* O₂ label */}
      <text
        x={cx}
        y={cy + 20}
        textAnchor="middle"
        fontSize="10"
        fill="#475569"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="0.05em"
      >
        O₂ OXYGEN
      </text>

      {/* ── Needle ── */}
      <g style={{ transition: "transform 0.35s ease", transformOrigin: `${cx}px ${cy}px` }}>
        <polygon
          points={`${needleTip.x},${needleTip.y} ${base1.x},${base1.y} ${tailTip.x},${tailTip.y} ${base2.x},${base2.y}`}
          fill="#1e293b"
          stroke="none"
        />
      </g>

      {/* Centre hub */}
      <circle cx={cx} cy={cy} r={9} fill="#374151" />
      <circle cx={cx} cy={cy} r={5} fill="#94a3b8" />
      <circle cx={cx} cy={cy} r={2} fill="#374151" />
    </svg>
  );
}

// ──────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────

export default function OxygenCalculator() {
  const [pressureInput, setPressureInput] = useState<string>("");
  const [flowRateInput, setFlowRateInput] = useState<string>("");
  const [unit, setUnit] = useState<Unit>("Bar");

  const results = useMemo(() => {
    const rawPressure = parseFloat(pressureInput);
    const rawFlow = parseFloat(flowRateInput);
    if (isNaN(rawPressure) || rawPressure < 0) return null;
    if (isNaN(rawFlow) || rawFlow <= 0) return null;

    const pressureBar = unit === "PSI" ? psiToBar(rawPressure) : rawPressure;
    const clampedBar = Math.min(pressureBar, FULL_PRESSURE_BAR);
    const remainingLiters = (clampedBar / FULL_PRESSURE_BAR) * FULL_CAPACITY_LITERS;
    const remainingMinutes = remainingLiters / rawFlow;

    const lowPressure = clampedBar < WARNING_BAR;
    const lowTime = remainingMinutes < WARNING_MINUTES;
    const showWarning = lowPressure || lowTime;

    return {
      pressureBar: clampedBar,
      remainingLiters,
      remainingMinutes,
      timeString: formatTimeString(remainingMinutes),
      lowPressure,
      lowTime,
      showWarning,
    };
  }, [pressureInput, flowRateInput, unit]);

  const gaugeBar = useMemo(() => {
    const raw = parseFloat(pressureInput);
    if (isNaN(raw) || raw < 0) return 0;
    return unit === "PSI" ? psiToBar(raw) : raw;
  }, [pressureInput, unit]);

  /** Show low-pressure warning even if flow rate is not yet entered */
  const pressureOnlyWarning = useMemo(() => {
    if (results) return false; // full results already handles warning
    const raw = parseFloat(pressureInput);
    if (isNaN(raw) || raw < 0) return false;
    const bar = unit === "PSI" ? psiToBar(raw) : raw;
    return bar > 0 && bar < WARNING_BAR;
  }, [pressureInput, unit, results]);

  const maxPressure = unit === "Bar" ? FULL_PRESSURE_BAR : FULL_PRESSURE_PSI;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex flex-col items-center py-8 px-4">

      {/* Header */}
      <header className="w-full max-w-2xl mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M9 2h6v2H9zM7 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H7zm1 3h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              O<sub>2</sub> Tank Calculator
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
              Medical Oxygen Supply Tool
            </p>
          </div>
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-blue-200 via-slate-200 to-transparent" />
      </header>

      <div className="w-full max-w-2xl space-y-5">

        {/* Gauge card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Pressure Gauge
            </h2>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-500">Critical</span>
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 ml-1" />
              <span className="text-slate-500">Caution</span>
              <span className="inline-block w-3 h-3 rounded-full bg-green-400 ml-1" />
              <span className="text-slate-500">Normal</span>
              <span className="inline-block w-3 h-3 rounded-full bg-green-800 ml-1" />
              <span className="text-slate-500">Good</span>
              <span className="inline-block w-3 h-3 rounded-full bg-slate-300 border border-slate-400 ml-1" />
              <span className="text-slate-500">Full</span>
            </div>
          </div>
          <div className="flex justify-center">
            <PressureGauge pressureBar={gaugeBar} unit={unit} />
          </div>
          <div className="flex justify-center mt-2 gap-4 text-xs text-slate-500 flex-wrap">
            <span>0–50 {unit === "Bar" ? "Bar" : "725 PSI"}: <span className="text-red-500 font-semibold">Critical</span></span>
            <span>50–100 {unit === "Bar" ? "Bar" : "1450 PSI"}: <span className="text-yellow-600 font-semibold">Caution</span></span>
            <span>100–200 {unit === "Bar" ? "Bar" : "2900 PSI"}: <span className="text-green-500 font-semibold">Normal</span></span>
            <span>200–230 {unit === "Bar" ? "Bar" : "3335 PSI"}: <span className="text-green-800 font-semibold">Good</span></span>
            <span>230–315 {unit === "Bar" ? "Bar" : "4568 PSI"}: <span className="text-slate-500 font-semibold">Full</span></span>
          </div>
        </div>

        {/* Inputs card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Tank Parameters
          </h2>
          <div className="space-y-4">
            {/* Pressure + unit toggle */}
            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1.5"
                htmlFor="pressure-input"
              >
                Current Tank Pressure
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="pressure-input"
                    type="number"
                    min="0"
                    max={maxPressure}
                    step="any"
                    placeholder={unit === "Bar" ? "e.g. 150" : "e.g. 2175"}
                    value={pressureInput}
                    onChange={(e) => setPressureInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    aria-label={`Current pressure in ${unit}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                    {unit}
                  </span>
                </div>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-slate-50 text-sm font-medium">
                  {(["Bar", "PSI"] as Unit[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => {
                        if (u !== unit) {
                          const val = parseFloat(pressureInput);
                          if (!isNaN(val)) {
                            if (u === "PSI") {
                              setPressureInput(String(Math.round(barToPsi(val))));
                            } else {
                              setPressureInput(
                                String(Math.round(psiToBar(val) * 10) / 10)
                              );
                            }
                          }
                          setUnit(u);
                        }
                      }}
                      className={`px-4 py-2.5 transition-all focus:outline-none ${
                        unit === u
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-pressed={unit === u}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Full tank = {unit === "Bar" ? "315 Bar" : "4568 PSI"} /{" "}
                {FULL_CAPACITY_LITERS} L capacity
              </p>
            </div>

            {/* Flow rate */}
            <div>
              <label
                className="block text-sm font-medium text-slate-700 mb-1.5"
                htmlFor="flow-rate-input"
              >
                Flow Rate
              </label>
              <div className="relative">
                <input
                  id="flow-rate-input"
                  type="number"
                  min="0.1"
                  step="0.5"
                  placeholder="e.g. 2"
                  value={flowRateInput}
                  onChange={(e) => setFlowRateInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  aria-label="Flow rate in litres per minute"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  L/min
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Typical adult: 1–6 L/min. High-flow: 10–15 L/min.
              </p>
            </div>
          </div>
        </div>

        {/* Results card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Results
          </h2>

          {!results ? (
            <div className="space-y-4">
              {pressureOnlyWarning && (
                <div
                  className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3"
                  role="alert"
                  aria-live="polite"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-500 flex-shrink-0 mt-0.5">
                    <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm-1 4h2v5h-2zm0 6h2v2h-2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Warning: Tank pressure is critically low (below 50 Bar)
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Arrange for tank replacement immediately.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-col items-center py-6 text-slate-400">
                <svg viewBox="0 0 24 24" className="w-10 h-10 mb-3 fill-current opacity-40">
                  <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm-1 4h2v5h-2zm0 6h2v2h-2z" />
                </svg>
                <p className="text-sm font-medium">Enter pressure and flow rate to calculate</p>
                <p className="text-xs mt-1 opacity-70">Results update as you type</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Warning banner */}
              {results.showWarning && (
                <div
                  className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3"
                  role="alert"
                  aria-live="polite"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 fill-red-500 flex-shrink-0 mt-0.5"
                  >
                    <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm-1 4h2v5h-2zm0 6h2v2h-2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      {results.lowPressure && results.lowTime
                        ? "Critical: Low pressure and low time remaining"
                        : results.lowPressure
                        ? "Warning: Tank pressure is critically low (below 50 Bar)"
                        : "Warning: Less than 30 minutes of oxygen remaining"}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Arrange for tank replacement immediately.
                    </p>
                  </div>
                </div>
              )}

              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-xl p-4 border ${
                    results.lowPressure
                      ? "bg-red-50 border-red-200"
                      : "bg-blue-50 border-blue-100"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Remaining Volume
                  </p>
                  <p
                    className={`text-3xl font-bold tabular-nums ${
                      results.lowPressure ? "text-red-600" : "text-blue-700"
                    }`}
                  >
                    {results.remainingLiters.toFixed(1)}
                    <span className="text-base font-medium ml-1">L</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(
                      (results.remainingLiters / FULL_CAPACITY_LITERS) *
                      100
                    ).toFixed(0)}
                    % of {FULL_CAPACITY_LITERS} L tank
                  </p>
                </div>

                <div
                  className={`rounded-xl p-4 border ${
                    results.lowTime
                      ? "bg-red-50 border-red-200"
                      : results.remainingMinutes < 60
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-emerald-50 border-emerald-100"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Time Remaining
                  </p>
                  <p
                    className={`text-xl font-bold leading-snug ${
                      results.lowTime
                        ? "text-red-600"
                        : results.remainingMinutes < 60
                        ? "text-yellow-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {results.timeString}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    At {parseFloat(flowRateInput).toFixed(1)} L/min flow rate
                  </p>
                </div>
              </div>

              {/* Breakdown row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-xs text-slate-500 font-medium">Pressure</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {unit === "Bar"
                      ? `${Math.round(results.pressureBar)} Bar`
                      : `${Math.round(barToPsi(results.pressureBar))} PSI`}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-xs text-slate-500 font-medium">Tank Fill</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {(
                      (results.pressureBar / FULL_PRESSURE_BAR) *
                      100
                    ).toFixed(0)}
                    %
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-xs text-slate-500 font-medium">Total Minutes</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {Math.floor(results.remainingMinutes)} min
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 text-center pb-4 leading-relaxed">
          For reference purposes only. Always follow clinical guidelines and
          <br />
          manufacturer specifications. Not a substitute for professional medical judgment.
        </p>
      </div>
    </div>
  );
}
