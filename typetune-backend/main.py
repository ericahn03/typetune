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

import os
import requests
import httpx
import certifi
from pymongo import MongoClient

load_dotenv()
app = FastAPI()

SOMERANDOMAPI_KEY = os.getenv("SOMERANDOMAPI_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# MongoDB setup
MONGO_URI = os.getenv("MONGODB_URI")
mongo_client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
db = mongo_client["typetune"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://typetune.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
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
    cache_path=None,
)

@app.get("/login")
def login():
    url = sp_oauth.get_authorize_url()
    return {"url": url}

@app.get("/callback")
def callback(code: str):
    token_url = "https://accounts.spotify.com/api/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": os.getenv("SPOTIPY_REDIRECT_URI"),
        "client_id": os.getenv("SPOTIPY_CLIENT_ID"),
        "client_secret": os.getenv("SPOTIPY_CLIENT_SECRET"),
    }
    response = requests.post(token_url, data=data)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Could not fetch token")
    tokens = response.json()
    return {"access_token": tokens["access_token"]}

@app.get("/top-tracks")
def get_top_tracks(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    sp = Spotify(auth=token)
    try:
        top_tracks = sp.current_user_top_tracks(limit=24, time_range="medium_term")
        artist_ids = [track["artists"][0]["id"] for track in top_tracks["items"] if "artists" in track and track["artists"]]
        artist_infos = sp.artists(artist_ids)["artists"] if artist_ids else []
        artist_lookup = {artist["id"]: {"genres": artist.get("genres", []), "popularity": artist.get("popularity", 0)} for artist in artist_infos}
        track_data = []
        for track in top_tracks["items"]:
            artist_id = track["artists"][0]["id"] if track["artists"] else None
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

# --- LYRICS ENDPOINT (SomeRandomAPI only) ---
@app.get("/lyrics/{track_id}")
async def get_lyrics(track_id: str, request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Missing Spotify access token")
    token = token.replace("Bearer ", "")
    res = requests.get(
        f"https://api.spotify.com/v1/tracks/{track_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail="Spotify track fetch failed")
    track = res.json()
    artist = track["artists"][0]["name"]
    title = track["name"]
    api_url = f"https://some-random-api.com/lyrics?title={title}&artist={artist}"
    headers = {"Authorization": SOMERANDOMAPI_KEY}
    lyrics_res = requests.get(api_url, headers=headers)
    try:
        lyrics_json = lyrics_res.json()
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": "Invalid lyrics API response"})
    if lyrics_res.status_code == 404 or not lyrics_json.get("lyrics"):
        return JSONResponse(status_code=404, content={"message": "Lyrics not found"})
    lyrics = lyrics_json.get("lyrics", "")
    summary = f"Lyrics fetched for '{title}' by {artist}."
    return {"lyrics": lyrics, "summary": summary, "track": {"title": title, "artist": artist}}

# --- ARTIST INSIGHT ENDPOINT WITH OPENROUTER ---
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

@app.get("/artist-insight/{track_id}")
async def get_artist_insight(track_id: str, request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Missing Spotify access token")
    token = token.replace("Bearer ", "")

    try:
        # --- 1. Fetch Spotify track and artist info
        track_resp = requests.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if track_resp.status_code != 200:
            raise HTTPException(status_code=track_resp.status_code, detail="Spotify track fetch failed")
        track = track_resp.json()
        artist_id = track["artists"][0]["id"]
        artist_name = track["artists"][0]["name"]

        # --- 2. Get Spotify artist info
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
        if spotify_info["genres"]:
            sources_used.append("spotify")
            combined_info += f"Genres: {', '.join(spotify_info['genres'])}.\n"

        # --- 3. Fallback: Use what we have
        if not combined_info.strip():
            combined_info = f"Write a 100-word bio for {artist_name}, a musical artist."

        # --- 4. DeepSeek/Horizon summary generation
        summary = await summarize_artist_info(artist_name, combined_info)
        sources_used.append("deepseek")

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
        return JSONResponse(status_code=500, content={"message": f"Artist insight error: {str(e)}"})

# --- RESULT SHARING AND PING ---
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
    result.pop("_id", None)
    return result

@app.get("/ping")
async def ping():
    return {"status": "ok"}
