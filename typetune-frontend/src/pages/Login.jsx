import { useEffect, useRef, useState } from "react";
import { LogIn, Music2, BrainCircuit, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import useActiveSection from "../hooks/useActiveSection";

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;
const SCOPE = "user-top-read user-read-private";
const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
  REDIRECT_URI
)}&scope=${encodeURIComponent(SCOPE)}&show_dialog=true`;

const LOCAL_KEY = "typetune_mbti_cache";
const SPOTIFY_KEY = "spotify_access_token";

export default function Login() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  const sectionIds = ["about", "how", "contact"];
  const activeSection = useActiveSection(sectionIds);

  // Always clear any cached MBTI result and token on landing here
  useEffect(() => {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(SPOTIFY_KEY);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setHeroVisible(true), 300);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div className="relative w-full min-h-screen font-sans">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="/vecteezy_green-energy-magic-waves-high-tech-digital-iridescent_40333382.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>

      {/* Dark Overlay */}
      <div className="fixed inset-0 bg-black/70 z-10 pointer-events-none" />

      {/* Sticky Header */}
      <header
        className={`sticky top-0 left-0 w-full z-30 px-6 py-5 flex items-center justify-between 
        bg-black/30 backdrop-blur-sm transition-shadow duration-300 ${
          scrolled ? "shadow-md" : "shadow-sm"
        }`}
      >
        <img src="/logo_typetune.png" alt="TypeTune Logo" className="h-10 w-auto object-contain" />
        {/* Desktop Navigation */}
        <nav className="hidden sm:flex gap-6 text-gray-300 font-medium">
          {sectionIds.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className={`transition-colors hover:text-green-400 ${
                activeSection === id ? "text-green-400" : ""
              }`}
            >
              {id.charAt(0).toUpperCase() + id.slice(1).replace("-", " ")}
            </a>
          ))}
        </nav>
        {/* Mobile Hamburger */}
        <div className="sm:hidden">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="text-gray-300 hover:text-green-400 focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-7 h-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>
        {/* Mobile Nav Panel */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute top-full left-0 w-full bg-black/90 backdrop-blur-md border-t border-white/10 flex flex-col items-center py-4 sm:hidden z-40"
          >
            {sectionIds.map((id) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setMenuOpen(false)}
                className={`py-2 text-gray-300 hover:text-green-400 font-medium ${
                  activeSection === id ? "text-green-400" : ""
                }`}
              >
                {id.charAt(0).toUpperCase() + id.slice(1).replace("-", " ")}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main
        className={`relative z-20 flex flex-col items-center justify-center w-full min-h-screen px-6 text-center transition-opacity duration-1000 ease-out scale-105 ${
          heroVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Title */}
        <motion.h2
          className="text-6xl md:text-7xl font-extrabold text-green-400 drop-shadow-[0_0_25px_#1DB954]"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          TypeTune
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-gray-200 text-base md:text-lg mt-3 mb-6 max-w-xl leading-tight font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Unlock your personality through your playlist.{" "}
          <br className="hidden sm:inline" />
          Let the music speak.
        </motion.p>

        {/* Features */}
        <motion.div
          className="flex flex-col sm:flex-row gap-5 sm:gap-10 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Feature icon={<Music2 />} text="Analyze your top tracks" />
          <Feature icon={<BrainCircuit />} text="Discover your MBTI type" />
          <Feature icon={<Share2 />} text="Share your vibe" />
        </motion.div>

        {/* Login Button */}
        <motion.a
          href={AUTH_URL}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <button className="flex items-center gap-3 bg-green-500 hover:bg-green-600 hover:scale-[1.03] text-white px-7 py-3 rounded-full text-base font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-300">
            <LogIn className="w-5 h-5" />
            Login with Spotify
          </button>
        </motion.a>
      </main>

      {/* Sections */}
      <Section id="about" title="About TypeTune">
        <div className="max-w-4xl mx-auto text-gray-300 space-y-6 leading-relaxed text-base md:text-lg">
          <p>
            <span className="text-green-400 font-semibold">TypeTune</span> is your personal audio mirror —
            an MBTI-powered insight engine that listens back. It analyzes your top Spotify tracks, favorite genres, and listening patterns
            to reveal who you are through what you vibe with.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm sm:text-base text-left">
            {[
              "Extraversion vs. Introversion (E/I)",
              "Sensing vs. Intuition (S/N)",
              "Thinking vs. Feeling (T/F)",
              "Judging vs. Perceiving (J/P)",
            ].map((trait, idx) => (
              <div
                key={idx}
                className="bg-white/5 backdrop-blur-md rounded-md px-4 py-3 border border-white/10 shadow-md text-green-300 font-medium"
              >
                {trait}
              </div>
            ))}
          </div>
          <p>
            Your MBTI result comes with a full breakdown — track popularity, genre leanings, artist stats — all translated into meaningful personality insights. You also get lyrics, emotional themes, and artist summaries for your top 24 tracks. It's music meets psychology, beautifully decoded.
          </p>
        </div>
      </Section>

      <Section id="how" title="How It Works" darker>
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 text-left text-gray-300">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 shadow-md"
          >
            <h3 className="text-green-400 text-xl font-semibold mb-2">1. Login Securely</h3>
            <p className="text-sm leading-relaxed">
              Connect with your Spotify account safely. TypeTune only reads your top tracks, keeping your listening data private and secure.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 shadow-md"
          >
            <h3 className="text-green-400 text-xl font-semibold mb-2">2. Analyze Your Tracks</h3>
            <ul className="text-sm leading-relaxed list-disc list-inside space-y-1 pl-1">
              <li><strong>Track Popularity:</strong> Mainstream vs. niche taste</li>
              <li><strong>Duration:</strong> Structured vs. freeform listening</li>
              <li><strong>Artist Popularity:</strong> Indie vs. major artists</li>
              <li><strong>Genres:</strong> Emotional + personality patterns</li>
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 shadow-md"
          >
            <h3 className="text-green-400 text-xl font-semibold mb-2">3. Calculate MBTI Type</h3>
            <p className="text-sm leading-relaxed">
              Our backend assigns weighted values to each track feature and genre, generating scores for all four MBTI dimensions:
            </p>
            <ul className="list-disc list-inside mt-2 pl-1 text-sm">
              <li>Extraversion vs. Introversion (E/I)</li>
              <li>Sensing vs. Intuition (S/N)</li>
              <li>Thinking vs. Feeling (T/F)</li>
              <li>Judging vs. Perceiving (J/P)</li>
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 shadow-md"
          >
            <h3 className="text-green-400 text-xl font-semibold mb-2">4. View Your Results</h3>
            <p className="text-sm leading-relaxed">
              Instantly get a visual breakdown of your MBTI type, full trait analysis, and song-based explanation. Share it with friends and vibe out.
            </p>
          </motion.div>
        </div>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Got questions or feedback? Reach out at{" "}
          <a href="mailto:typetune.contact@gmail.com" className="underline text-green-300 hover:text-green-200">
            typetune.contact@gmail.com
          </a>
        </p>
      </Section>

      {/* Footer */}
      <footer className="relative z-20 py-6 text-center text-sm text-gray-400 border-t border-white/10 bg-black/80">
        <p>© 2025 TypeTune • Built with React, Tailwind, and FastAPI</p>
        <p className="text-xs mt-1">
          <a
            href="https://www.vecteezy.com/free-videos/particle"
            className="underline hover:text-green-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            Particle Stock Videos by Vecteezy
          </a>
        </p>
      </footer>
    </div>
  );
}

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-gray-300 text-sm sm:text-base">
      <span className="text-green-400 w-6 h-6">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Section({ id, title, children, darker = false }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, amount: 0.2 }}
      className={`relative z-20 py-24 px-4 text-center text-gray-100 ${
        darker ? "bg-black/50" : "bg-black/60"
      }`}
    >
      <motion.h2
        className="text-3xl font-bold text-green-400 mb-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        {title}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        viewport={{ once: true }}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
