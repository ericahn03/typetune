import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeftCircle, RefreshCcw } from "lucide-react";

export default function Lyrics() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("spotify_access_token");

  const [lyricsData, setLyricsData] = useState(null);
  const [artistInsight, setArtistInsight] = useState(null);
  const [artistLoading, setArtistLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const lyricsCacheKey = `lyrics_${trackId}`;
  const artistCacheKey = `artist_${trackId}`;

  const fetchLyrics = async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      setError(null);

      if (!forceRefresh) {
        const cached = localStorage.getItem(lyricsCacheKey);
        if (cached) {
          setLyricsData(JSON.parse(cached));
          setError(null);
          return;
        }
      }

      const res = await axios.get(`${import.meta.env.VITE_API_URL}/lyrics/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const raw = res.data.lyrics || "";
      const lines = raw
        .replace(/(\r\n|\r|\n)+/g, "\n")
        .split("\n")
        .filter(line => line.trim() !== "")
        .filter(
          line =>
            !/^\d+\s+Contributors$/.test(line) &&
            !/^Translations$/i.test(line)
        )
        .map(line =>
          line
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\)([A-Z])/g, ") $1")
            .replace(/"([A-Z])/g, '" $1')
        );

      const formattedLyrics = lines.map(line => `<p>${line}</p>`).join("");

      const result = {
        summary: res.data.summary,
        lyrics: formattedLyrics,
        track: res.data.track || {},
      };

      setLyricsData(result);
      localStorage.setItem(lyricsCacheKey, JSON.stringify(result));
    } catch (err) {
      console.error(err);
      setError("Lyrics could not be loaded for this track.");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchArtistInsight = async (forceRefresh = false) => {
    try {
      setArtistLoading(true);

      if (!forceRefresh) {
        const cached = localStorage.getItem(artistCacheKey);
        if (cached) {
          setArtistInsight(JSON.parse(cached));
          setArtistLoading(false);
          return;
        }
      }

      const res = await axios.get(`${import.meta.env.VITE_API_URL}/artist-insight/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setArtistInsight(res.data);
      localStorage.setItem(artistCacheKey, JSON.stringify(res.data));
    } catch (err) {
      console.error("Error fetching artist insight:", err);
    } finally {
      setArtistLoading(false);
    }
  };

  useEffect(() => {
    fetchLyrics();
    fetchArtistInsight();
  }, [trackId, token]);

  const handleRefresh = () => {
    localStorage.removeItem(lyricsCacheKey);
    localStorage.removeItem(artistCacheKey);
    fetchLyrics(true);
    fetchArtistInsight(true);
  };

  const toggleExpand = () => setExpanded(prev => !prev);

  return (
    <div className="min-h-screen relative px-6 py-10" style={{ backgroundColor: "#121212", color: "#ffffff" }}>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{
        backgroundImage: `url('/lyrics_bg.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        opacity: 0.2,
      }} />

      <div className="relative z-10 max-w-5xl mx-auto space-y-12">
        <button
          onClick={() => navigate("/result")}
          className="flex items-center gap-2 text-green-400 hover:underline"
        >
          <ArrowLeftCircle className="w-5 h-5" />
          Back to Results
        </button>

        {/* Player */}
        <div className="overflow-hidden rounded-lg border border-white/10 shadow-lg">
          <iframe
            src={`https://open.spotify.com/embed/track/${trackId}`}
            width="100%"
            height="80"
            frameBorder="0"
            scrolling="no"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="w-full h-20"
            style={{ border: "none" }}
          />
        </div>

        {/* Lyrics */}
        <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-inner" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.25)" }}>
          <div className="flex justify-center items-center gap-2 mb-4">
            <h2 className="text-2xl font-semibold text-green-400" style={{ textShadow: "0 0 8px rgba(34,197,94,0.5)" }}>
              Lyrics
            </h2>
            <button
              onClick={handleRefresh}
              className="group p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
              title="Refresh Lyrics"
              aria-label="Refresh Lyrics"
            >
              <RefreshCcw
                className={`w-5 h-5 text-green-300 transition-transform duration-500 ${
                  refreshing ? "animate-spin" : "group-hover:rotate-180"
                }`}
              />
            </button>
          </div>

          {!lyricsData?.lyrics && error && (
            <p className="text-red-400 text-center">{error}</p>
          )}

          {lyricsData?.lyrics ? (
            <>
              <div
                className={`text-white text-lg leading-relaxed space-y-3 text-center transition-all duration-300 overflow-hidden ${
                  expanded ? "max-h-[9999px]" : "max-h-[300px]"
                }`}
                dangerouslySetInnerHTML={{ __html: lyricsData.lyrics }}
              />
              {!expanded && (
                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none" />
              )}
              <div className="text-center mt-4">
                <button
                  onClick={toggleExpand}
                  className="text-sm text-green-300 hover:underline focus:outline-none"
                >
                  {expanded ? "Show Less" : "Show Full Lyrics"}
                </button>
              </div>
            </>
          ) : (
            !error && <p className="text-gray-300 text-center">Loading lyrics...</p>
          )}
        </div>

        {/* Summary */}
        {lyricsData?.summary && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg space-y-3" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.25)" }}>
            <h2 className="text-2xl font-semibold text-green-400">Song Summary</h2>
            <p className="text-base text-gray-300 leading-relaxed">{lyricsData.summary}</p>
          </div>
        )}

        {/* Artist Insight */}
        {artistLoading ? (
          <p className="text-gray-300 text-center">Loading artist information...</p>
        ) : artistInsight && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.25)" }}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="col-span-12 md:col-span-4 flex flex-col items-center justify-center text-center space-y-3">
                <img
                  src={artistInsight.image}
                  alt="Artist"
                  className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover border-2 border-green-400 shadow-md"
                />
                <h2 className="text-xl md:text-2xl font-semibold text-green-400 mt-2">
                  {artistInsight.artist_name}
                </h2>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>Genres: {artistInsight.genres?.join(", ") || "N/A"}</p>
                  <p>Popularity: {artistInsight.popularity ?? "N/A"}/100</p>
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 flex flex-col justify-center text-sm text-gray-300 leading-relaxed text-left space-y-3">
                {artistInsight.summary ? (
                  <>
                    <p>{artistInsight.summary}</p>
                    {artistInsight.sources_used?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {artistInsight.sources_used.map((source, idx) => (
                          <span
                            key={idx}
                            className="bg-green-800/30 text-green-300 px-3 py-1 text-xs font-medium rounded-full border border-green-500/50 animate-fade-in"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="italic text-gray-400">No bio available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

console.log("Fetching:", `${import.meta.env.VITE_API_URL}/lyrics/${trackId}`);
console.log("Token exists?", Boolean(token));
console.log("trackId:", trackId);