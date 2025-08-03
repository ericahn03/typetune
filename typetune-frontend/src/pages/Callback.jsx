import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error === "access_denied") {
      navigate("/"); // Redirect back to login page
      return;
    }

    const code = params.get("code");
    if (!code) {
      console.error("No code in URL");
      navigate("/"); // Fallback redirect if something else goes wrong
      return;
    }

    console.log("Code from Spotify:", code); // ✅ Debug

    const exchangeCodeForToken = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/callback?code=${code}`);
        const { access_token } = res.data;

        console.log("Received access token:", access_token); // ✅ Debug

        localStorage.setItem("spotify_access_token", access_token);
        navigate("/result");
      } catch (err) {
        console.error("Token exchange failed:", err);
        navigate("/"); // Send back to login if it fails
      }
    };

    exchangeCodeForToken();
  }, [navigate]);

  return <div className="text-center mt-12 text-lg text-white">Logging you in...</div>;
}
