import { useState, useMemo } from "react";

const FULL_CAPACITY_LITERS = 490;
const FULL_PRESSURE_BAR = 200;
const FULL_PRESSURE_PSI = 2900;
const WARNING_MINUTES = 30;
const WARNING_BAR = 50;

type Unit = "Bar" | "PSI";

function psiToBar(psi: number): number {
  return psi / 14.5;
}

function barToPsi(bar: number): number {
  return bar * 14.5;
}

function formatTime(totalMinutes: number): { hours: number; minutes: number } {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return { hours: h, minutes: m };
}

function formatTimeString(totalMinutes: number): string {
  const { hours, minutes } = formatTime(totalMinutes);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

// SVG Semicircular gauge
function PressureGauge({
  pressureBar,
  unit,
}: {
  pressureBar: number;
  unit: Unit;
}) {
  const cx = 150;
  const cy = 155;
  const r = 115;
  const strokeWidth = 22;

  // Arc goes from 210° to 330° (left to right, bottom semicircle excluded)
  // Full sweep = 240°
  const startAngleDeg = 210;
  const endAngleDeg = 330;
  const totalSweep = 240;

  function polarToCartesian(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arcPath(fromDeg: number, toDeg: number) {
    const start = polarToCartesian(fromDeg);
    const end = polarToCartesian(toDeg);
    const sweep = toDeg - fromDeg;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  // Color zones in Bar: 0-50 red, 50-100 yellow, 100-200 green
  // Map to degrees
  function barToDeg(bar: number) {
    return startAngleDeg + (bar / FULL_PRESSURE_BAR) * totalSweep;
  }

  const zone1End = barToDeg(50);   // red zone end (50 bar)
  const zone2End = barToDeg(100);  // yellow zone end (100 bar)
  const zone3End = endAngleDeg;    // green zone end (200 bar)

  // Clamp value
  const clampedBar = Math.min(Math.max(pressureBar, 0), FULL_PRESSURE_BAR);
  const needleDeg = barToDeg(clampedBar);

  // Needle
  const needleLength = r - strokeWidth / 2 - 8;
  const needleBase = 10;
  const needleRad = (needleDeg * Math.PI) / 180;
  const needleTip = {
    x: cx + needleLength * Math.cos(needleRad),
    y: cy + needleLength * Math.sin(needleRad),
  };
  // Two base points perpendicular to needle
  const perpRad = needleRad + Math.PI / 2;
  const base1 = {
    x: cx + needleBase * Math.cos(perpRad),
    y: cy + needleBase * Math.sin(perpRad),
  };
  const base2 = {
    x: cx - needleBase * Math.cos(perpRad),
    y: cy - needleBase * Math.sin(perpRad),
  };

  // Gauge color based on current pressure
  let needleColor = "#16a34a";
  if (clampedBar <= 50) needleColor = "#dc2626";
  else if (clampedBar <= 100) needleColor = "#ca8a04";

  // Tick marks
  const ticks = [];
  const majorTicks = [0, 50, 100, 150, 200];
  for (let bar = 0; bar <= 200; bar += 10) {
    const deg = barToDeg(bar);
    const rad = (deg * Math.PI) / 180;
    const isMajor = majorTicks.includes(bar);
    const innerR = r - (isMajor ? 30 : 22);
    const outerR = r - 4;
    ticks.push({
      x1: cx + innerR * Math.cos(rad),
      y1: cy + innerR * Math.sin(rad),
      x2: cx + outerR * Math.cos(rad),
      y2: cy + outerR * Math.sin(rad),
      isMajor,
      label: isMajor ? (unit === "Bar" ? String(bar) : String(Math.round(barToPsi(bar)))) : null,
      labelX: cx + (r - 44) * Math.cos(rad),
      labelY: cy + (r - 44) * Math.sin(rad),
    });
  }

  const displayMax = unit === "Bar" ? "200 Bar" : "2900 PSI";
  const displayMin = unit === "Bar" ? "0 Bar" : "0 PSI";

  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-[340px]" aria-label="Pressure gauge">
      {/* Background track */}
      <path
        d={arcPath(startAngleDeg, endAngleDeg)}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Red zone: 0 to 50 bar */}
      <path
        d={arcPath(startAngleDeg, zone1End)}
        fill="none"
        stroke="#fca5a5"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />

      {/* Yellow zone: 50 to 100 bar */}
      <path
        d={arcPath(zone1End, zone2End)}
        fill="none"
        stroke="#fde68a"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />

      {/* Green zone: 100 to 200 bar */}
      <path
        d={arcPath(zone2End, zone3End)}
        fill="none"
        stroke="#86efac"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Zone border lines */}
      {[zone1End, zone2End].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const inner = r - strokeWidth / 2 - 1;
        const outer = r + strokeWidth / 2 + 1;
        return (
          <line
            key={i}
            x1={cx + inner * Math.cos(rad)}
            y1={cy + inner * Math.sin(rad)}
            x2={cx + outer * Math.cos(rad)}
            y2={cy + outer * Math.sin(rad)}
            stroke="white"
            strokeWidth={2}
          />
        );
      })}

      {/* Tick marks */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={t.x1} y1={t.y1}
            x2={t.x2} y2={t.y2}
            stroke={t.isMajor ? "#475569" : "#94a3b8"}
            strokeWidth={t.isMajor ? 2 : 1}
          />
          {t.label !== null && (
            <text
              x={t.labelX}
              y={t.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="#64748b"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              {t.label}
            </text>
          )}
        </g>
      ))}

      {/* Needle */}
      <polygon
        points={`${needleTip.x},${needleTip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
        fill={needleColor}
        stroke="white"
        strokeWidth="1.5"
        style={{ transition: "all 0.3s ease" }}
      />

      {/* Center pivot */}
      <circle cx={cx} cy={cy} r={10} fill="#1e293b" />
      <circle cx={cx} cy={cy} r={4} fill="#f1f5f9" />

      {/* Min/max labels */}
      <text x="28" y="180" fontSize="8" fill="#64748b" fontFamily="system-ui, sans-serif" textAnchor="middle">{displayMin}</text>
      <text x="272" y="180" fontSize="8" fill="#64748b" fontFamily="system-ui, sans-serif" textAnchor="middle">{displayMax}</text>

      {/* Center pressure readout */}
      <text
        x={cx}
        y={cy - 30}
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill={needleColor}
        fontFamily="system-ui, sans-serif"
        style={{ transition: "fill 0.3s ease" }}
      >
        {unit === "Bar"
          ? `${Math.round(clampedBar)}`
          : `${Math.round(barToPsi(clampedBar))}`}
      </text>
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fontSize="9"
        fill="#94a3b8"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="0.05em"
      >
        {unit.toUpperCase()}
      </text>
    </svg>
  );
}

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

  const maxPressure = unit === "Bar" ? FULL_PRESSURE_BAR : FULL_PRESSURE_PSI;
  const pressureLabel = unit === "Bar" ? "Bar" : "PSI";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex flex-col items-center justify-start py-8 px-4">
      {/* Header */}
      <header className="w-full max-w-2xl mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 2h6v2H9zM7 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H7zm1 3h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">O<sub>2</sub> Tank Calculator</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Medical Oxygen Supply Tool</p>
          </div>
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-blue-200 via-slate-200 to-transparent" />
      </header>

      <div className="w-full max-w-2xl space-y-5">
        {/* Gauge card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pressure Gauge</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" />
              <span className="text-slate-500">Critical</span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-200 inline-block ml-2" />
              <span className="text-slate-500">Caution</span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-300 inline-block ml-2" />
              <span className="text-slate-500">Normal</span>
            </div>
          </div>
          <div className="flex justify-center">
            <PressureGauge pressureBar={gaugeBar} unit={unit} />
          </div>
          <div className="flex justify-center mt-1 gap-6 text-xs text-slate-500">
            <span>0–50 {unit === "Bar" ? "Bar" : "725 PSI"}: <span className="text-red-500 font-semibold">Critical</span></span>
            <span>50–100 {unit === "Bar" ? "Bar" : "1450 PSI"}: <span className="text-yellow-600 font-semibold">Caution</span></span>
            <span>100–200 {unit === "Bar" ? "Bar" : "2900 PSI"}: <span className="text-green-600 font-semibold">Normal</span></span>
          </div>
        </div>

        {/* Inputs card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Tank Parameters</h2>

          <div className="space-y-4">
            {/* Pressure input + unit toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="pressure-input">
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
                    {pressureLabel}
                  </span>
                </div>
                {/* Unit toggle */}
                <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-slate-50 text-sm font-medium">
                  {(["Bar", "PSI"] as Unit[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => {
                        if (u !== unit) {
                          // Convert current input value to new unit
                          const val = parseFloat(pressureInput);
                          if (!isNaN(val)) {
                            if (u === "PSI") {
                              setPressureInput(String(Math.round(barToPsi(val))));
                            } else {
                              setPressureInput(String(Math.round(psiToBar(val) * 10) / 10));
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
                Full tank = {unit === "Bar" ? "200 Bar" : "2900 PSI"} / {FULL_CAPACITY_LITERS} L capacity
              </p>
            </div>

            {/* Flow rate input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="flow-rate-input">
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
                Typical adult flow: 1–6 L/min. Typical high-flow: 10–15 L/min.
              </p>
            </div>
          </div>
        </div>

        {/* Results card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Results</h2>

          {!results ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <svg viewBox="0 0 24 24" className="w-10 h-10 mb-3 fill-current opacity-40">
                <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm-1 4h2v5h-2zm0 6h2v2h-2z"/>
              </svg>
              <p className="text-sm font-medium">Enter pressure and flow rate to calculate</p>
              <p className="text-xs mt-1 opacity-70">Results update as you type</p>
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
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-500 flex-shrink-0 mt-0.5">
                    <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 2a8 8 0 100 16A8 8 0 0012 4zm-1 4h2v5h-2zm0 6h2v2h-2z"/>
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

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Remaining liters */}
                <div className={`rounded-xl p-4 border ${results.lowPressure ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Remaining Volume</p>
                  <p className={`text-3xl font-bold tabular-nums ${results.lowPressure ? "text-red-600" : "text-blue-700"}`}>
                    {results.remainingLiters.toFixed(1)}
                    <span className="text-base font-medium ml-1">L</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {((results.remainingLiters / FULL_CAPACITY_LITERS) * 100).toFixed(0)}% of {FULL_CAPACITY_LITERS} L tank
                  </p>
                </div>

                {/* Time remaining */}
                <div className={`rounded-xl p-4 border ${results.lowTime ? "bg-red-50 border-red-200" : results.remainingMinutes < 60 ? "bg-yellow-50 border-yellow-200" : "bg-emerald-50 border-emerald-100"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Time Remaining</p>
                  <p className={`text-3xl font-bold tabular-nums ${results.lowTime ? "text-red-600" : results.remainingMinutes < 60 ? "text-yellow-700" : "text-emerald-700"}`}>
                    {results.remainingMinutes >= 60 ? (
                      <>
                        {formatTime(results.remainingMinutes).hours}
                        <span className="text-base font-medium ml-0.5">h</span>
                        {" "}
                        {formatTime(results.remainingMinutes).minutes}
                        <span className="text-base font-medium ml-0.5">m</span>
                      </>
                    ) : (
                      <>
                        {Math.floor(results.remainingMinutes)}
                        <span className="text-base font-medium ml-1">min</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    At {parseFloat(flowRateInput).toFixed(1)} L/min flow rate
                  </p>
                </div>
              </div>

              {/* Breakdown row */}
              <div className="grid grid-cols-3 gap-2 pt-1">
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
                    {((results.pressureBar / FULL_PRESSURE_BAR) * 100).toFixed(0)}%
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
          This tool is for reference purposes only. Always follow clinical guidelines<br />
          and manufacturer specifications. Not a substitute for professional medical judgment.
        </p>
      </div>
    </div>
  );
}
