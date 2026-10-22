/** Decorative only: animation never changes the evidence or the layout. */
export default function OrbitFrame({ dial = false }: { dial?: boolean }) {
  return (
    <>
      <svg
        className={`orbit-frame ${dial ? "orbit-frame-dial" : ""}`}
        aria-hidden="true"
        focusable="false"
      >
        <rect x="1" y="1" rx="22" className="orbit-frame-outline" />
        <rect
          x="1"
          y="1"
          rx="22"
          pathLength="1000"
          className="orbit-frame-traveler"
        />
      </svg>
      {!dial &&
        ["upper", "lower"].map((corner) => (
          <svg
            key={corner}
            className={`frame-constellation ${corner}`}
            viewBox="0 0 80 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M4 18 27 6 55 10 76 3"
              className="orbit-frame-constellation"
            />
            <g className="orbit-frame-stars">
              <circle cx="4" cy="18" r="1.7" />
              <circle cx="27" cy="6" r="2" />
              <circle cx="55" cy="10" r="1.4" />
              <circle cx="76" cy="3" r="1.7" />
            </g>
          </svg>
        ))}
    </>
  );
}

export function DialRim() {
  return (
    <svg
      className="dial-rim"
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="100" cy="100" r="94" className="dial-rim-outline" />
      <circle
        cx="100"
        cy="100"
        r="87"
        className="dial-rim-ticks"
        pathLength="120"
      />
      <g className="dial-rim-orbit">
        <circle
          cx="100"
          cy="100"
          r="94"
          className="dial-rim-arc"
          pathLength="100"
        />
        <circle cx="100" cy="6" r="2.8" className="dial-rim-star" />
      </g>
    </svg>
  );
}
