import { useEffect, useState } from "react";


export default function MBTIBars({ traitScores, isShared = false }) {
  const [mounted, setMounted] = useState(false);
  const [animatedValues, setAnimatedValues] = useState({});

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (mounted) {
      const intervals = {};
      Object.entries(traitScores).forEach(([trait, { value }]) => {
        const rawValue = parseFloat(value);
        const displayValue = rawValue >= 50 ? rawValue : 100 - rawValue;
        let current = 0;
        intervals[trait] = setInterval(() => {
          current += 0.3;
          if (current >= displayValue) {
            current = displayValue;
            clearInterval(intervals[trait]);
          }
          setAnimatedValues(prev => ({ ...prev, [trait]: current.toFixed(2) }));
        }, 10);
      });
      return () => Object.values(intervals).forEach(clearInterval);
    }
  }, [mounted, traitScores]);

  const traitColors = {
    "E vs I": "from-green-400 to-emerald-600",
    "S vs N": "from-yellow-300 to-yellow-500",
    "T vs F": "from-rose-400 to-pink-600",
    "J vs P": "from-indigo-400 to-violet-600",
  };

  const traitLabels = {
    "E vs I": ["Extroverted", "Introverted"],
    "S vs N": ["Sensing", "Intuitive"],
    "T vs F": ["Thinking", "Feeling"],
    "J vs P": ["Judging", "Perceiving"],
  };

  return (
    <div className="space-y-8">
      {Object.entries(traitScores).map(([trait, { direction, value }]) => {
        const [leftLabel, rightLabel] = traitLabels[trait];
        const barColor = traitColors[trait] || "from-gray-500 to-gray-700";
        const rawValue = parseFloat(value);

        const isRight =
          trait !== "J vs P" && (
            (trait === "E vs I" && direction === "I") ||
            (trait === "S vs N" && direction === "N") ||
            (trait === "T vs F" && direction === "F")
          );

        const displayValue = rawValue >= 50 ? rawValue : 100 - rawValue;
        const animatedValue = animatedValues[trait] || 0;

        const fillStyle = {
          width: mounted ? `${displayValue}%` : 0,
          left: isRight ? "auto" : 0,
          right: isRight ? 0 : "auto",
          transition: "width 2.5s ease-out"
        };

        const knobStyle = {
          ...(isRight
            ? { right: mounted ? `${displayValue}%` : 0, transform: "translate(50%, -50%)" }
            : { left: mounted ? `${displayValue}%` : 0, transform: "translate(-50%, -50%)" }),
          transition: "all 2.5s ease-out"
        };

        const labelAboveKnobStyle = {
          ...(isRight
            ? { right: mounted ? `${displayValue}%` : 0, transform: "translateX(50%)" }
            : { left: mounted ? `${displayValue}%` : 0, transform: "translateX(-50%)" }),
          transition: "all 2.5s ease-out"
        };

        return (
          <div key={trait}>
            <div className="flex justify-between mb-1 text-sm font-medium text-gray-200">
              <span>{leftLabel}</span>
              <span>{rightLabel}</span>
            </div>
            <div className="relative h-10">
              {/* Percentage above knob */}
              <div
                className="absolute -top-5 z-10 text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 drop-shadow-sm tracking-wider font-mono"
                style={labelAboveKnobStyle}
              >
                {animatedValue}%
              </div>

              {/* Bar background */}
              <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 h-full ${
                    isRight ? "bg-gradient-to-l" : "bg-gradient-to-r"
                  } ${barColor}`}
                  style={fillStyle}
                />
              </div>

              {/* White knob */}
              <div
                className="absolute top-1/2 w-4 h-4 bg-white border-2 border-gray-400 rounded-full shadow-sm z-20"
                style={knobStyle}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}