from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from pydantic import BaseModel
from typing import List, Dict, Optional
from dotenv import load_dotenv
from mbti_engine import infer_mbti
from uuid import uuid4
from threading import Lock

import os
import requests
import lyricsgenius
import httpx

# NEW: MongoDB
from pymongo import MongoClient

load_dotenv()
app = FastAPI()

# Tokens
GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# MongoDB setup
MONGO_URI = os.getenv("MONGODB_URI")
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["typetune"]

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Spotify Auth Setup
sp_oauth = SpotifyOAuth(
    client_id=os.getenv("SPOTIPY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI"),
    scope="user-top-read user-read-private",
    cache_path=".cache-typetune",
)

@app.get("/login")
def login():
    return {"url": sp_oauth.get_authorize_url()}

@app.get("/callback")
def callback(code: str):
    token_info = sp_oauth.get_access_token(code)
    if not token_info:
        raise HTTPException(status_code=400, detail="Could not fetch token")
    return {"access_token": token_info["access_token"]}

@app.get("/top-tracks")
def get_top_tracks(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    sp = Spotify(auth=token)

    try:
        top_tracks = sp.current_user_top_tracks(limit=24, time_range="medium_term")
        artist_ids = [track["artists"][0]["id"] for track in top_tracks["items"]]
        artist_infos = sp.artists(artist_ids)["artists"]

        artist_lookup = {
            artist["id"]: {
                "genres": artist.get("genres", []),
                "popularity": artist.get("popularity", 0),
            }
            for artist in artist_infos
        }

        track_data = []
        for track in top_tracks["items"]:
            artist_id = track["artists"][0]["id"]
            artist_info = artist_lookup.get(artist_id, {})

            track_data.append({
                "track_name": track["name"],
                "track_id": track["id"],
                "album": track["album"]["name"],
                "album_image": track["album"]["images"][0]["url"],
                "release_date": track["album"]["release_date"],
                "duration_ms": track["duration_ms"],
                "popularity": track["popularity"],
                "explicit": track["explicit"],
                "artist_names": [artist["name"] for artist in track["artists"]],
                "artist_ids": [artist["id"] for artist in track["artists"]],
                "artist_genres": artist_info.get("genres", []),
                "artist_popularity": artist_info.get("popularity", 0),
            })

        return {"tracks": track_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching top tracks: {str(e)}")

class AudioFeaturesPayload(BaseModel):
    audio_features: List[Dict]

@app.post("/mbti")
def get_mbti(data: AudioFeaturesPayload):
    if not data.audio_features:
        raise HTTPException(status_code=400, detail="No audio features provided")
    return infer_mbti(data.audio_features)

# Genius client setup
genius = lyricsgenius.Genius(
    GENIUS_TOKEN,
    skip_non_songs=True,
    remove_section_headers=True,
    verbose=False
)
genius.timeout = 10
genius.retries = 3
genius.response_format = 'plain'

# DeepSeek summary generator (unchanged)
async def generate_summary_with_deepseek(artist: str, title: str):
    prompt = (
        f"Summarize the meaning and emotion behind the song '{title}' by {artist}' in a single, friendly, ~100‑word paragraph. "
        f"Focus on lyrical themes, tone, and emotional takeaways. Include interpretations shaped by how listeners or community members often react—what feelings or ideas fans say it conveys. "
        f"Keep the tone human, conversational, and relatable—no jargon, no robotic facts—just music‑savvy commentary that feels like someone explaining it after hearing it."
    )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://typetune.vercel.app",
        "X-Title": "TypeTune"
    }

    payload = {
        "model": "openrouter/horizon-alpha",
        "messages": [
            {"role": "system", "content": "You are a helpful music expert."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 300
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

def get_lyrics_from_genius(artist: str, title: str):
    try:
        song = genius.search_song(title=title.strip(), artist=artist.strip())
        if song and song.lyrics:
            return song.lyrics.strip()

        fallback_query = f"{title} {artist}"
        song = genius.search_song(fallback_query)
        if song and song.lyrics:
            return song.lyrics.strip()

        return None
    except Exception:
        return None

@app.get("/lyrics/{track_id}")
async def get_lyrics(track_id: str, request: Request):
    print(f"Incoming request for track ID: {track_id}")
    
    token = request.headers.get("Authorization")
    if not token:
        print("❌ Missing Authorization header")
        raise HTTPException(status_code=401, detail="Missing Spotify access token")
    token = token.replace("Bearer ", "")
    
    try:
        print("Fetching track metadata from Spotify...")
        res = requests.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Spotify response status: {res.status_code}")
        
        if res.status_code != 200:
            print("❌ Spotify track fetch failed")
            raise HTTPException(status_code=res.status_code, detail="Spotify track fetch failed")
        
        track = res.json()
        artist = track["artists"][0]["name"]
        title = track["name"]
        print(f"Track title: {title}, Artist: {artist}")

        print("Fetching lyrics from Genius...")
        lyrics = get_lyrics_from_genius(artist, title)
        if not lyrics:
            print(f"[Genius] Searching lyrics for {artist} - {title}")
            print("❌ No lyrics found")
            return JSONResponse(status_code=404, content={"message": "Lyrics not found"})

        print("Generating summary with DeepSeek...")
        summary = await generate_summary_with_deepseek(artist, title)

        print("Successfully fetched lyrics and summary")
        return {"lyrics": lyrics, "summary": summary}

    except Exception as e:
        print(f"💥 Internal server error: {e}")
        return JSONResponse(status_code=500, content={"message": f"Server error: {str(e)}"})

async def summarize_artist_info(artist_name: str, input_text: str) -> str:
    prompt = (
        f"Using the following info, write a short ~100-word biography of the musical artist '{artist_name}'. "
        f"Focus on genre, background, notable achievements, and overall style. Make it sound casual, music-savvy, "
        f"and human — like something from a fan blog or artist spotlight.\n\n"
        f"INFO:\n{input_text}"
    )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "TypeTune"
    }

    payload = {
        "model": "openrouter/horizon-alpha",
        "messages": [
            {"role": "system", "content": "You are a helpful music expert."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 300
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

@app.get("/artist-insight/{track_id}")
async def get_artist_insight(track_id: str, request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Missing Spotify access token")
    token = token.replace("Bearer ", "")

    try:
        # Fetch Spotify track and artist info
        print(f"Fetching track metadata for ID: {track_id}")
        track_resp = requests.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if track_resp.status_code != 200:
            raise HTTPException(status_code=track_resp.status_code, detail="Spotify track fetch failed")
        track = track_resp.json()
        artist_id = track["artists"][0]["id"]
        artist_name = track["artists"][0]["name"]
        print(f"Artist Name: {artist_name}")

        # Spotify artist data
        sp = Spotify(auth=token)
        artist_data = sp.artist(artist_id)
        spotify_info = {
            "name": artist_data.get("name"),
            "genres": artist_data.get("genres", []),
            "popularity": artist_data.get("popularity"),
            "image": artist_data.get("images", [{}])[0].get("url"),
            "spotify_url": artist_data.get("external_urls", {}).get("spotify")
        }

        sources_used = []
        combined_info = ""

        # Add Spotify info to prompt if available
        if spotify_info["genres"]:
            sources_used.append("spotify")
            combined_info += f"Genres: {', '.join(spotify_info['genres'])}.\n"

        # Try Genius bio
        try:
            print("Searching Genius bio...")
            genius_artist = genius.search_artist(artist_name, max_songs=1, sort="popularity")
            genius_bio = genius_artist.description.strip() if genius_artist and genius_artist.description else None
            if genius_bio:
                sources_used.append("genius")
                combined_info += f"Genius Bio: {genius_bio}\n"
        except Exception as e:
            print(f"❌ Genius error: {e}")
            genius_bio = None

        # Fallback if no info available
        if not combined_info.strip():
            combined_info = f"Write a 100-word bio for {artist_name}, a musical artist."

        # DeepSeek summary generation
        print(f"Info to summarize:\n{combined_info[:300]}")
        print("Generating artist summary with DeepSeek...")
        summary = await summarize_artist_info(artist_name, combined_info)
        sources_used.append("deepseek")
        print(f"Summary generated: {summary[:100]}...")

        return {
            "artist_name": spotify_info["name"],
            "image": spotify_info["image"],
            "genres": spotify_info["genres"],
            "popularity": spotify_info["popularity"],
            "spotify_url": spotify_info["spotify_url"],
            "summary": summary,
            "sources_used": sources_used
        }

    except Exception as e:
        print(f"💥 Artist insight error: {e}")
        return JSONResponse(status_code=500, content={"message": f"Artist insight error: {str(e)}"})

# ======== PERSISTENT RESULT STORAGE W/ MONGODB ========

class SharedResult(BaseModel):
    mbti: str
    summary: str
    breakdown: Dict
    tracks_used: List[Dict]
    user: Optional[str] = None
    spotify_id: Optional[str] = None

@app.post("/save-result")
def save_result(result: SharedResult):
    result_id = str(uuid4())
    record = result.dict()
    record["result_id"] = result_id
    db.results.insert_one(record)
    return {"result_id": result_id}

@app.get("/result/{result_id}")
def get_result(result_id: str):
    result = db.results.find_one({"result_id": result_id})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    # MongoDB adds an "_id" field, which can't be serialized to JSON; remove it
    result.pop("_id", None)
    return result
