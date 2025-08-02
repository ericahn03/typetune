import requests

from bs4 import BeautifulSoup
from collections import Counter

import os

def infer_mbti(features):
    def avg(key):
        values = [f[key] for f in features if f.get(key) is not None]
        print(f"Averaging {key}: {values}")
        return sum(values) / len(values) if values else 0

    def top_genres():
        genre_list = [genre for f in features for genre in f.get("artist_genres", [])]
        genre_counts = Counter(genre_list)
        print("Top genres:", genre_counts.most_common(3))
        return genre_counts.most_common(3)

    # --- Compute Averages ---
    track_popularity = avg("popularity")            # 0–100
    duration_ms = avg("duration_ms")                # 180,000 ~ 240,000 typical
    artist_popularity = avg("artist_popularity")    # 0–100
    common_genres = top_genres()
    genre_tags = [g[0] for g in common_genres]

    # --- Scoring & Logic ---

    # E vs I
    ei_score = track_popularity / 100
    if any(g in genre_tags for g in ['dance pop', 'pop rap', 'edm']):
        ei_score += 0.03
    ei_score = min(max(ei_score, 0), 1)

    # S vs N
    expected_average = 215000
    sn_score = (expected_average - duration_ms) / 120000 + 0.5
    if 'acoustic' in genre_tags:
        sn_score += 0.02
    sn_score = min(max(sn_score, 0), 1)
    sn = 'S' if sn_score >= 0.5 else 'N'

    # T vs F
    tf_score = artist_popularity / 100
    if any(g in genre_tags for g in ['rap', 'trap', 'metal']):
        tf_score += 0.04
    elif any(g in genre_tags for g in ['r&b', 'soul', 'neo mellow', 'ballad', 'k-ballad']):
        tf_score -= 0.04
    tf_score = min(max(tf_score, 0), 1)

    # J vs P
    j_genres = {'classical', 'k-pop', 'j-pop', 'indie pop', 'broadway', 'neo mellow', 'dance pop', 'pop'}
    p_genres = {'lo-fi', 'alt z', 'trap', 'vaporwave', 'indie rock', 'psychedelic rock'}

    jp_score = 0.5  # neutral baseline
    for g in genre_tags:
        if g in j_genres:
            jp_score += 0.05
        elif g in p_genres:
            jp_score -= 0.05
    jp_score = min(max(jp_score, 0), 1)

    # --- Final MBTI ---
    ei = 'E' if ei_score >= 0.5 else 'I'
    sn = 'S' if sn_score >= 0.5 else 'N'
    tf = 'T' if tf_score >= 0.5 else 'F'
    jp = 'J' if jp_score >= 0.5 else 'P'
    mbti = ei + sn + tf + jp

    return {
        "mbti": mbti,
        "breakdown": {
            "avg_track_popularity": round(track_popularity, 2),
            "avg_duration_ms": round(duration_ms, 2),
            "avg_artist_popularity": round(artist_popularity, 2),
            "top_genres": genre_tags,
            "mbti_logic": {
                "E vs I": {
                    "direction": ei,
                    "value": round(ei_score * 100, 2),
                    "reason": "based on popularity + extroverted genre boost"
                },
                "S vs N": {
                    "direction": sn,
                    "value": round(sn_score * 100, 2),
                    "reason": "based on duration + acoustic influence"
                },
                "T vs F": {
                    "direction": tf,
                    "value": round(tf_score * 100, 2),
                    "reason": "based on artist popularity + genre edge/emotion"
                },
                "J vs P": {
                    "direction": jp,
                    "value": round(jp_score * 100, 2),
                    "reason": "based on genre structure vs improvisation"
                }
            }
        },
        "summary": f"Based on your music metadata, you're {mbti} — {explain_mbti(mbti)}"
    }


def explain_mbti(mbti):
    explanations = {
        "INFP": "a soulful daydreamer drawn to heartfelt lyrics and mellow vibes",
        "INFJ": "a thoughtful curator with a taste for introspective and layered sounds",
        "INTP": "a sonic explorer who digs into the abstract and experimental",
        "INTJ": "a visionary listener crafting playlists with purpose and depth",
        "ISFP": "a chill vibe-seeker who lets emotion guide their soundscape",
        "ISFJ": "a nostalgic heart who finds comfort in familiar, warm melodies",
        "ISTP": "a hands-on tinkerer with a love for clean beats and sonic precision",
        "ISTJ": "a no-nonsense listener who sticks to structure and timeless tracks",
        "ENFP": "a vibrant sound-chaser always chasing new rhythms and genres",
        "ENFJ": "a playlist architect who uplifts and connects through music",
        "ENTP": "a genre-bender who thrives on unpredictability and bold drops",
        "ENTJ": "a confident selector who curates with drive and big-picture flow",
        "ESFP": "a born performer with a playlist made to move the crowd",
        "ESFJ": "a feel-good DJ who tunes into everyone's vibe",
        "ESTP": "an energy junkie spinning bold, high-tempo bangers",
        "ESTJ": "a playlist planner with a love for structure and classics"
    }

    return explanations.get(mbti, "a unique vibe all your own")

def search_genius(artist: str, title: str):
    headers = {"Authorization": f"Bearer {os.getenv('GENIUS_ACCESS_TOKEN')}"}
    query = f"{artist} {title}"
    search_url = "https://api.genius.com/search"
    response = requests.get(search_url, params={"q": query}, headers=headers)

    if response.status_code != 200:
        return None

    hits = response.json()["response"]["hits"]
    if not hits:
        return None

    # Use the first match
    song_path = hits[0]["result"]["path"]
    return f"https://genius.com{song_path}"

def scrape_lyrics(genius_url: str):
    page = requests.get(genius_url)
    soup = BeautifulSoup(page.text, "html.parser")
    
    # This selector may change — test it carefully
    lyrics_div = soup.select_one("div[class^='Lyrics__Container']")
    
    if not lyrics_div:
        return None

    lyrics = lyrics_div.get_text(separator="\n").strip()
    return lyrics

def get_lyrics_summary(artist: str, title: str):
    try:
        genius_url = search_genius(artist, title)
        if not genius_url:
            return None, "Lyrics not found on Genius."

        raw_lyrics = scrape_lyrics(genius_url)
        if not raw_lyrics:
            return None, "Couldn’t extract lyrics from Genius."

        # Example emotion highlights (simplified)
        highlighted = raw_lyrics.replace("love", "<span class='text-pink-400 font-bold'>love</span>")
        highlighted = highlighted.replace("hate", "<span class='text-red-400 font-bold'>hate</span>")

        summary = f"This song by {artist} explores themes of love, emotion, and introspection."
        return highlighted, summary

    except Exception as e:
        print("Lyrics error:", e)
        return None, "An error occurred while fetching lyrics."