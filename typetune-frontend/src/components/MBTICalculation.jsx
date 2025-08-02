import {
  BarChart3,
  Clock,
  Mic,
  Scale,
  SlidersHorizontal,
} from "lucide-react";

export default function MBTICalculation({ breakdown, isShared = false }) {
  if (!breakdown) return null;

  const {
    avg_track_popularity,
    avg_duration_ms,
    avg_artist_popularity,
    top_genres,
    mbti_logic,
  } = breakdown;

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")} (mm:ss)`;
  };

  const traitDetails = {
    "E vs I": {
      title: (
        <span className="inline-flex items-center gap-2">
          <BarChart3 size={16} className={isShared ? "text-sky-300" : "text-green-300"} />
          Extroversion vs Introversion
        </span>
      ),
      base: `Your average track popularity was ${avg_track_popularity.toFixed(2)}%. Higher popularity tends to correlate with Extroversion.`,
      boost: top_genres
        .filter((g) => ["dance pop", "pop rap", "edm"].includes(g))
        .map(
          (g) =>
            `Genre boost: "${g}" reflects social energy and extroversion → +0.03 for Extroversion`
        ),
      fallback: "No extroverted genre boost applied.",
      reason:
        "Popular tracks and energetic genres indicate extroverted music preferences.",
      calc: `(${avg_track_popularity.toFixed(
        2
      )} / 100) + 0.03 if applicable based on genre modifiers`,
    },
    "S vs N": {
      title: (
        <span className="inline-flex items-center gap-2">
          <Clock size={16} className="text-yellow-400" />
          Sensing vs Intuition
        </span>
      ),
      base: `Tracks shorter than 3:35 (the average duration of 215,000ms) suggest Sensing. Your average track length was ${formatDuration(
        avg_duration_ms
      )}.`,
      boost: top_genres.includes("acoustic")
        ? [
            'Genre boost: "acoustic" reflects grounded and detail-focused style → +0.02 for Sensing',
          ]
        : [],
      fallback: "No Sensing-related genre boost applied.",
      reason:
        "Sensing types prefer direct, grounded content like shorter or acoustic tracks.",
      calc: `((215000 - ${avg_duration_ms.toFixed(
        0
      )}) / 120000) + 0.5 + 0.02 if 'acoustic'`,
    },
    "T vs F": {
      title: (
        <span className="inline-flex items-center gap-2">
          <Mic size={16} className="text-rose-400" />
          Thinking vs Feeling
        </span>
      ),
      base: `Your average artist popularity was ${avg_artist_popularity.toFixed(
        2
      )}%. Higher popularity correlates with Thinking types who prioritize performance metrics and success.`,
      boost: (() => {
        const b = [];
        ["rap", "trap", "metal"].forEach((g) => {
          if (top_genres.includes(g)) {
            b.push(
              `Genre boost: "${g}" reflects assertiveness and edge → +0.04 for Thinking`
            );
          }
        });
        [
          "r&b",
          "soul",
          "neo mellow",
          "ballad",
          "k-ballad",
        ].forEach((g) => {
          if (top_genres.includes(g)) {
            b.push(
              `Genre penalty: "${g}" reflects emotional expression → -0.04 for Thinking`
            );
          }
        });
        return b;
      })(),
      fallback: "No genre boost or penalty applied.",
      reason:
        "Analytical genres like rap or metal tend to reflect Thinking, while emotional genres indicate Feeling.",
      calc: `(${avg_artist_popularity.toFixed(
        2
      )} / 100) ± 0.04 based on genre modifiers`,
    },
    "J vs P": {
      title: (
        <span className="inline-flex items-center gap-2">
          <Scale size={16} className="text-indigo-400" />
          Judging vs Perceiving
        </span>
      ),
      base: "Scoring starts at a neutral 50%. Genre structure is used to adjust for Judging or Perceiving preferences.",
      boost: top_genres
        .map((g) => {
          if (
            [
              "classical",
              "k-pop",
              "j-pop",
              "indie pop",
              "broadway",
              "neo mellow",
              "dance pop",
              "pop",
            ].includes(g)
          ) {
            return `Genre boost: "${g}" reflects order and planning → +0.05 for Judging`;
          }
          if (
            [
              "lo-fi",
              "alt z",
              "trap",
              "vaporwave",
              "indie rock",
              "psychedelic rock",
            ].includes(g)
          ) {
            return `Genre penalty: "${g}" reflects spontaneity and improvisation → -0.05 for Perceiving`;
          }
          return null;
        })
        .filter(Boolean),
      fallback: "No genre traits affected Judging vs Perceiving.",
      reason:
        "Structured or chaotic genres help determine planning vs flexibility.",
      calc: "50% ± 0.05 based on genre modifiers",
    },
  };

  return (
    <section className="mt-16">
      <h2
        className={`text-2xl font-semibold ${
          isShared ? "text-sky-400" : "text-green-400"
        } mb-6 flex items-center gap-2`}
      >
        <SlidersHorizontal
          className={`w-6 h-6 ${
            isShared ? "text-sky-400" : "text-green-400"
          }`}
        />
        Trait Calculation Breakdown
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        {Object.entries(mbti_logic).map(([trait, info]) => {
          const detail = traitDetails[trait];
          const rawValue = parseFloat(info.value);
          const displayValue = rawValue >= 50 ? rawValue : 100 - rawValue;

          return (
            <div
              key={trait}
              className={`bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg p-6 shadow-lg`}
            >
              <h3
                className={`text-lg font-bold ${
                  isShared ? "text-sky-400" : "text-green-400"
                } mb-2`}
              >
                {detail.title}
              </h3>
              <p className="text-white">
                <strong>Final Direction:</strong> {info.direction}
              </p>
              <p className="text-white">
                <strong>Final Score:</strong> {displayValue.toFixed(2)}%
              </p>
              <div className="mt-3">
                <p className="text-gray-300 font-medium">Step-by-step:</p>
                <ul className="list-disc text-sm text-gray-300 mt-1 space-y-1 pl-5">
                  <li>{detail.base}</li>
                  {detail.boost.length > 0 ? (
                    detail.boost.map((b, i) => <li key={i}>{b}</li>)
                  ) : (
                    <li>{detail.fallback}</li>
                  )}
                  <li className="italic">Raw calculation: {detail.calc}</li>
                </ul>
              </div>
              <p className="mt-3 text-xs italic text-gray-400">
                {detail.reason}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
