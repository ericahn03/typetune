import { useEffect, useState } from "react";
import axios from "axios";
import MBTIBars from "../components/MBTIBars";
import MBTICalculation from "../components/MBTICalculation";
import {
  SearchCheck, BarChart2, Clock3, Star, Tags,
  Music2, RefreshCcw, Share2, Check, Home,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";

const LOCAL_KEY = "typetune_mbti_cache";
const SPOTIFY_KEY = "spotify_access_token";

// --- Animated Glassy Share Button ---
function FloatingActionButton({ mbti, isShared }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const resultId = mbti?.result_id;
    const shareUrl = resultId
      ? `${window.location.origin}/result/${resultId}/shared`
      : window.location.origin;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (window.navigator.vibrate) window.navigator.vibrate(30);
      setTimeout(() => setCopied(false), 1700);
    } catch {
      alert("Failed to copy the link. Please try manually!");
    }
  };

  if (isShared) {
    return (
      <div className="fixed bottom-6 left-0 w-full flex justify-center z-50 pointer-events-none md:bottom-10">
        <button
          onClick={() => navigate("/")}
          className={`
            flex items-center gap-2
            bg-gradient-to-r from-blue-600 via-sky-500 to-blue-400
            text-white font-bold px-8 py-3 rounded-full shadow-full
            hover:scale-105 active:scale-95
            transition-all duration-200 ease-out text-lg pointer-events-auto
            border-none
            backdrop-blur-xl
            outline-none
            ring-2 ring-blue-400/30 hover:ring-blue-400/90
            drop-shadow-[0_0_25px_#60a5fa60]
          `}
          style={{
            boxShadow: "0 4px 24px 0 rgba(59,130,246,0.20), 0 1.5px 4px 0 rgba(0,0,0,0.15)",
          }}
        >
          <Home className="w-6 h-6 text-white animate-pulse" />
          <span>Try Your Audio Type</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {copied && (
        <div className="
          fixed left-1/2 bottom-32 -translate-x-1/2
          bg-green-600/90 text-white px-6 py-3
          rounded-xl shadow-lg z-50 pointer-events-none select-none w-max text-center">
          Link copied to clipboard!
        </div>
      )}

      <motion.div
        className="fixed bottom-6 left-0 w-full flex justify-center z-50 pointer-events-none md:bottom-10"
        aria-live="polite"
        initial={false}
        animate={copied ? { y: -8, scale: 1.05 } : { y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <motion.button
          onClick={handleShare}
          whileTap={{ scale: 0.97, y: 2 }}
          whileHover={{ scale: 1.05, boxShadow: "0 0 40px #1db95470" }}
          className={`
            flex items-center gap-2
            bg-gradient-to-r from-green-500 via-green-400 to-green-600/80 ring-green-400/30 hover:ring-green-400/90 drop-shadow-[0_0_25px_#1db95460]
            text-white font-bold px-8 py-3 rounded-full shadow-full
            hover:scale-105 active:scale-95
            transition-all duration-200 ease-out text-lg pointer-events-auto
            border-none backdrop-blur-xl outline-none
          `}
          style={{
            boxShadow: "0 4px 24px 0 rgba(30,185,84,0.20), 0 1.5px 4px 0 rgba(0,0,0,0.15)",
          }}
        >
          {copied ? (
            <>
              <Check className="w-6 h-6 text-white animate-bounce" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-6 h-6 text-white" />
              <span>Copy Share Link</span>
            </>
          )}
        </motion.button>
      </motion.div>
    </>
  );
}

// --- Main Result Component ---
export default function Result() {
  const [mbti, setMbti] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSpotifyId, setCurrentSpotifyId] = useState(null);
  const [userDisplayName, setUserDisplayName] = useState("");
  const token = localStorage.getItem(SPOTIFY_KEY);
  const navigate = useNavigate();
  const { resultId, shared } = useParams();
  const isShared = window.location.pathname.endsWith("/shared");

  // Helper to clean all local auth data (recommended on logout)
  const clearAuthCache = () => {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(SPOTIFY_KEY);
  };

  useEffect(() => {
    let ignore = false;
    async function loadResult() {
      setLoading(true);

      let fetchedSpotifyId = null;
      let fetchedDisplayName = "";
      if (token) {
        try {
          const { data: userData } = await axios.get(
            "https://api.spotify.com/v1/me",
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetchedSpotifyId = userData.id;
          fetchedDisplayName = userData.display_name || "";
          setCurrentSpotifyId(fetchedSpotifyId);
          setUserDisplayName(fetchedDisplayName);
        } catch {
          fetchedSpotifyId = null;
        }
      }

      // If shared result (with resultId in URL)
      if (resultId) {
        try {
          const { data: sharedResult } = await axios.get(
            `${import.meta.env.VITE_API_URL}/result/${resultId}`
          );
          setMbti(sharedResult);

          // Redirect to personal result if this is actually the current user's result
          if (
            token &&
            sharedResult.spotify_id &&
            sharedResult.spotify_id === fetchedSpotifyId
          ) {
            // navigate("/result", { replace: true });
            // return;
          }
        } catch {
          setMbti(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      // --- PERSONAL RESULT FLOW ---
      // Step 1: Always check the cache Spotify ID against current user ID
      let useCache = false;
      let cachedMbti = null;
      if (fetchedSpotifyId) {
        const cacheRaw = localStorage.getItem(LOCAL_KEY);
        if (cacheRaw) {
          try {
            cachedMbti = JSON.parse(cacheRaw);
            // If cache does NOT match this Spotify user, wipe cache.
            if (
              !cachedMbti.spotify_id ||
              cachedMbti.spotify_id !== fetchedSpotifyId
            ) {
              localStorage.removeItem(LOCAL_KEY);
              cachedMbti = null;
            } else {
              useCache = true;
            }
          } catch {
            // Bad cache? Nuke it.
            localStorage.removeItem(LOCAL_KEY);
          }
        }
      } else {
        localStorage.removeItem(LOCAL_KEY); // Not logged in? Clear cache.
      }

      // Step 2: If valid cache found, use it
      if (useCache && cachedMbti) {
        setMbti(cachedMbti);
        setLoading(false);
        return;
      }

      // Step 3: No cache OR user changed: recalc result
      if (token && fetchedSpotifyId) {
        try {
          const { data: topData } = await axios.get(
            `${import.meta.env.VITE_API_URL}/top-tracks`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const features = topData.tracks.map(track => ({
            popularity: track.popularity,
            duration_ms: track.duration_ms,
            artist_popularity: track.artist_popularity,
            artist_genres: track.artist_genres,
          }));

          const { data: mbtiResult } = await axios.post(
            `${import.meta.env.VITE_API_URL}/mbti`,
            { audio_features: features }
          );

          const formattedTracks = topData.tracks.map(track => {
            const totalSeconds = Math.floor(track.duration_ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = String(totalSeconds % 60).padStart(2, "0");
            return { ...track, duration_formatted: `${minutes}:${seconds}` };
          });

          // Save to backend, tie to this user
          const { data: saveResp } = await axios.post(
            `${import.meta.env.VITE_API_URL}/save-result`,
            {
              mbti: mbtiResult.mbti,
              summary: mbtiResult.summary,
              breakdown: mbtiResult.breakdown,
              tracks_used: formattedTracks,
              user: fetchedDisplayName,
              spotify_id: fetchedSpotifyId,
            }
          );

          // Update URL
          window.history.replaceState({}, "", `/result/${saveResp.result_id}`);

          const result = {
            ...mbtiResult,
            tracks_used: formattedTracks,
            user: fetchedDisplayName,
            spotify_id: fetchedSpotifyId,
            result_id: saveResp.result_id,
          };
          localStorage.setItem(LOCAL_KEY, JSON.stringify(result));
          setMbti(result);
        } catch {
          setMbti(null);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        setMbti(null);
      }
    }

    loadResult();
    return () => { ignore = true; };
    // eslint-disable-next-line
  }, [token, resultId]);

  if (loading)
    return <div className="text-center text-white mt-16 text-xl">Analyzing your music...</div>;
  if (!mbti)
    return <div className="text-center text-yellow-400 mt-16 text-lg">This shared result is no longer available or the link is invalid.</div>;


  return (
    <div className="relative w-full min-h-screen font-sans overflow-x-hidden overflow-y-auto">
      {/* --- Background Video --- */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0"
      >
        <source
          src={isShared ? "/sharedview_bg.mp4" : "/result_bg.mp4"}
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>

      {/* --- Overlay for darkness and readability --- */}
      <div className="fixed inset-0 bg-black/70 z-10 pointer-events-none" />

      <div className="relative z-20 max-w-6xl mx-auto space-y-12 px-6 py-10">
        {/* MBTI Header */}
        <div className="text-center space-y-2 relative">
        <h1 className="text-5xl font-extrabold flex justify-center items-center gap-3 text-white relative">
          {isShared
            ? (mbti.user
                ? `${mbti.user}'s Audio Type:`
                : "Shared Audio Type:")
            : "Your Audio Type:"}
          <span
            className={
              isShared
                ? "bg-gradient-to-r from-blue-600 via-sky-500 to-blue-400 text-transparent bg-clip-text drop-shadow-[0_0_10px_#60a5fa]"
                : "text-green-400 drop-shadow-[0_0_10px_#1DB954]"
            }
          >
            {mbti.mbti}
          </span>
          {!isShared && (
            <>
              {/* Refresh Button */}
              <button
                onClick={() => {
                  localStorage.removeItem(LOCAL_KEY);
                  navigate("/result", { replace: true });
                  window.location.reload();
                }}
                className="group relative p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                title="Refresh Results"
                aria-label="Refresh Results"
              >
                <RefreshCcw className="w-5 h-5 text-green-300 group-hover:rotate-180 transition-transform duration-500" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-xs text-white px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  Refresh Results
                </span>
              </button>
              {/* Home Button */}
              <button
                onClick={() => {
                  localStorage.removeItem(LOCAL_KEY);
                  localStorage.removeItem(SPOTIFY_KEY);
                  navigate("/", { replace: true });
                }}
                className="group ml-2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                title="Go Home"
                aria-label="Go Home"
                style={{
                  boxShadow: "0 2px 10px 0 rgba(30,185,84,0.10)",
                  verticalAlign: "middle",
                }}
              >
                <Home className="w-5 h-5 text-green-300 group-hover:scale-110 group-hover:text-green-400 transition-transform duration-300" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-xs text-white px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Go Home
                </span>
              </button>
            </>
          )}
        </h1>
          <p className={isShared ? "text-sky-300" : "text-gray-300"}>
            {isShared
              ? mbti.summary
                  .replace(/\byou('|’)?re\b/gi, "this person is")
                  .replace(/\byou are\b/gi, "this person is")
                  .replace(/\byour\b/gi, "their")
              : mbti.summary}
          </p>
        </div>

        {/* MBTI Breakdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(mbti.breakdown).map(([key, value]) => {
            if (key === "mbti_logic") return null;
            return (
              <div key={key} className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-lg p-5 text-center hover:scale-105 transform transition duration-300 shadow-lg">
                <h3 className={`uppercase text-xs font-bold ${isShared ? "text-sky-400" : "text-green-400"} tracking-wide`}>
                  {key.replace(/_/g, " ")}
                </h3>
                <p className="text-lg mt-2 font-medium text-white">
                  {typeof value === "number"
                    ? value.toFixed(2)
                    : Array.isArray(value)
                    ? value.join(", ")
                    : JSON.stringify(value)}
                </p>
              </div>
            );
          })}
        </div>

        {/* MBTI Logic */}
        <div>
          <h2 className={`text-2xl font-semibold ${isShared ? "text-sky-400" : "text-green-400"} mb-4 flex items-center gap-2`}>
            <SearchCheck className={`w-6 h-6 ${isShared ? "text-sky-400" : "text-green-400"}`} />
            Detailed MBTI Results
          </h2>
          <MBTIBars traitScores={mbti.breakdown.mbti_logic} isShared={isShared} />
        </div>

        <MBTICalculation breakdown={mbti.breakdown} isShared={isShared} />

        {/* Track Cards */}
        <div>
          <h2 className={`text-2xl font-semibold ${isShared ? "text-sky-400" : "text-green-400"} mb-4 flex items-center gap-2`}>
            <Music2 className={`w-6 h-6 ${isShared ? "text-sky-400" : "text-green-400"}`} />
            Top 24 Tracks Analyzed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {mbti.tracks_used?.map((track, idx) => (
              <div
                key={idx}
                onClick={!isShared ? () => navigate(`/lyrics/${track.track_id}`) : undefined}
                className={`block ${!isShared ? 'cursor-pointer hover:scale-105' : 'cursor-default'} bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl rounded-xl shadow-lg p-4 transition-transform duration-300`}
              >
                <img
                  src={track.album_image}
                  alt={track.track_name}
                  className="w-full h-48 object-cover rounded-md mb-3"
                />
                <h3 className="text-white font-semibold text-lg">{track.track_name}</h3>
                <p className="text-sm text-gray-400 mb-2">{track.artist_names?.join(", ")}</p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-gray-400" />
                    Popularity: {track.popularity}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-gray-400" />
                    Duration: {track.duration_formatted}
                  </p>
                  <p className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-gray-400" />
                    Artist Popularity: {track.artist_popularity}
                  </p>
                  <p className="flex items-center gap-2">
                    <Tags className="w-4 h-4 text-gray-400" />
                    Genres: {track.artist_genres?.join(", ") || "N/A"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* --- Floating Share Button --- */}
      <FloatingActionButton mbti={mbti} isShared={isShared} />
    </div>
  );
}
