import { useEffect, useState } from "react";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
const pad = (n: number) => String(n).padStart(2, "0");
function parts(date: Date, utc: boolean) {
  const hours = utc ? date.getUTCHours() : date.getHours();
  const minutes = utc ? date.getUTCMinutes() : date.getMinutes();
  const seconds = utc ? date.getUTCSeconds() : date.getSeconds();
  return {
    hours,
    minutes,
    seconds,
    digital: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

export function OrbitMark({ size = 42 }: { size?: number }) {
  return (
    <svg
      className="observatory-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="16.5" stroke="currentColor" strokeWidth=".8" />
      <ellipse
        cx="24"
        cy="24"
        rx="23"
        ry="9"
        transform="rotate(-42 24 24)"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <path
        d="M16 33 24 13 32 33M19 26H29"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M39 7V15M35 11H43" stroke="var(--accent)" strokeWidth="1.2" />
      <circle cx="8" cy="33" r="2" fill="var(--accent)" />
    </svg>
  );
}

export function StarMap() {
  return (
    <svg
      className="star-map"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g className="constellation-lines">
        <path d="M890 116 1036 74 1154 150 1328 91 1431 209 1532 181M1036 74 1099 260 1260 336 1431 209M1099 260 957 361 1009 491M274 709 383 648 461 741 566 701M383 648 360 504" />
        <circle cx="1290" cy="165" r="255" />
        <circle cx="1290" cy="165" r="327" />
        <ellipse
          cx="1290"
          cy="165"
          rx="460"
          ry="158"
          transform="rotate(-31 1290 165)"
        />
      </g>
      <g className="star-points">
        {[
          [890, 116, 1.5],
          [1036, 74, 2.3],
          [1154, 150, 1.5],
          [1328, 91, 2],
          [1431, 209, 2.8],
          [1532, 181, 1.3],
          [1099, 260, 1.4],
          [1260, 336, 1.8],
          [957, 361, 1.4],
          [1009, 491, 1.7],
          [274, 709, 1.3],
          [383, 648, 2],
          [461, 741, 1.5],
          [566, 701, 1],
          [360, 504, 1.6],
          [678, 87, 1.2],
          [726, 380, 1],
          [862, 680, 1.8],
          [1322, 701, 1.2],
          [1517, 898, 1.4],
          [1200, 875, 1],
          [612, 510, 1],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}

export function ClockReadout({
  utc,
  onToggle,
}: {
  utc: boolean;
  onToggle: () => void;
}) {
  const now = useClock();
  return (
    <button
      className="clock-readout"
      onClick={onToggle}
      title="切换 UTC / 本地时间"
      aria-label="切换时钟时区"
    >
      <span className="clock-readout-orbit" aria-hidden="true">
        <i style={{ transform: `rotate(${parts(now, utc).seconds * 6}deg)` }} />
      </span>
      <time dateTime={now.toISOString()} data-testid="live-clock-digital">
        {parts(now, utc).digital}
      </time>
      <small>{utc ? "UTC" : "LOCAL"}</small>
    </button>
  );
}

export default function AstralClock({
  utc,
  first,
  last,
  onToggle,
}: {
  utc: boolean;
  first: string | null;
  last: string | null;
  onToggle: () => void;
}) {
  const now = useClock();
  const [reference, setReference] = useState<"live" | "first" | "last">("live");
  const selected =
    reference === "first" ? first : reference === "last" ? last : null;
  const time =
    selected && !Number.isNaN(Date.parse(selected)) ? new Date(selected) : now;
  const { hours, minutes, seconds, digital } = parts(time, utc);
  const hourAngle = (hours % 12) * 30 + minutes / 2 + seconds / 120;
  const minuteAngle = minutes * 6 + seconds / 10;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(utc ? { timeZone: "UTC" } : {}),
  })
    .format(time)
    .toUpperCase();
  return (
    <section className="astral-clock" aria-label="天文钟时间仪表">
      <div className="clock-caption">
        <span>CHRONOGRAPH</span>
        <span>01 / AURA</span>
      </div>
      <div className="clock-instrument">
        <svg
          viewBox="0 0 320 320"
          className="clock-dial"
          role="img"
          aria-label={`${reference === "live" ? "实时" : "日志参考"}时钟 ${digital} ${utc ? "UTC" : "本地时间"}`}
        >
          <circle cx="160" cy="160" r="149" className="clock-faint" />
          <circle cx="160" cy="160" r="138" className="clock-faint" />
          <circle cx="160" cy="160" r="122" className="clock-ring" />
          <circle
            cx="160"
            cy="160"
            r="96"
            className="clock-faint"
            strokeDasharray="1 7"
          />
          <ellipse
            cx="160"
            cy="160"
            rx="146"
            ry="63"
            transform="rotate(-31 160 160)"
            className="clock-ecliptic"
          />
          <path
            d="M160 5V21M160 299V315M5 160H21M299 160H315"
            className="clock-axis"
          />
          {Array.from({ length: 60 }, (_, i) => (
            <line
              key={i}
              x1="160"
              y1={i % 5 === 0 ? "31" : "35"}
              x2="160"
              y2={i % 5 === 0 ? "42" : "39"}
              transform={`rotate(${i * 6} 160 160)`}
              className={i % 5 === 0 ? "clock-hour-tick" : "clock-minute-tick"}
            />
          ))}
          {[
            "XII",
            "I",
            "II",
            "III",
            "IV",
            "V",
            "VI",
            "VII",
            "VIII",
            "IX",
            "X",
            "XI",
          ].map((label, i) => {
            const angle = ((i * 30 - 90) * Math.PI) / 180;
            return (
              <text
                key={label}
                x={160 + 109 * Math.cos(angle)}
                y={160 + 109 * Math.sin(angle) + 4}
                className="clock-numeral"
              >
                {label}
              </text>
            );
          })}
          <circle cx="160" cy="160" r="74" className="clock-core" />
          <path
            d="M111 185Q160 158 209 185M130 206H190"
            className="clock-faint"
          />
          <text x="160" y="183" className="clock-inscription">
            AURA
          </text>
          <text x="160" y="198" className="clock-inscription small">
            EVENT OBSERVATORY
          </text>
          <g
            transform={`rotate(${hourAngle} 160 160)`}
            data-testid="clock-hour-hand"
            data-angle={hourAngle}
          >
            <path d="M160 170V99" className="clock-hour-hand" />
            <path d="M155 110 160 95 165 110" className="clock-hand-tip" />
          </g>
          <g transform={`rotate(${minuteAngle} 160 160)`}>
            <path d="M160 177V68" className="clock-minute-hand" />
          </g>
          <g transform={`rotate(${seconds * 6} 160 160)`}>
            <path d="M160 185V51" className="clock-second-hand" />
            <circle cx="160" cy="24" r="3.5" className="clock-satellite" />
          </g>
          <circle cx="160" cy="160" r="5" className="clock-pivot" />
          <circle cx="160" cy="160" r="1.5" fill="var(--bg)" />
        </svg>
      </div>
      <div className="clock-digital">
        <time
          dateTime={time.toISOString()}
          data-testid="observatory-clock-digital"
        >
          {digital}
        </time>
        <button onClick={onToggle} title="切换 UTC / 本地时间">
          {utc ? "UTC" : "LOCAL"}
          <span>↗</span>
        </button>
      </div>
      <div className="clock-date">
        {date}
        <span>{reference === "live" ? "LIVE TIME" : "EVIDENCE TIME"}</span>
      </div>
      <div className="clock-references" role="group" aria-label="时钟参考时间">
        <button
          className={reference === "live" ? "active" : ""}
          onClick={() => setReference("live")}
        >
          实时
        </button>
        <button
          disabled={!first}
          className={reference === "first" ? "active" : ""}
          onClick={() => setReference("first")}
        >
          日志起点
        </button>
        <button
          disabled={!last}
          className={reference === "last" ? "active" : ""}
          onClick={() => setReference("last")}
        >
          日志终点
        </button>
      </div>
    </section>
  );
}
