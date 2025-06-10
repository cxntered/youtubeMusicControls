/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "Vencord";

import { API_PATH, BASE_URL } from "./constants";

export interface Song {
    title: string;
    alternativeTitle: string;
    artist: string;
    views: number;
    uploadDate: string;
    imageSrc: string;
    isPaused: boolean;
    songDuration: number;
    elapsedSeconds: number;
    url: string;
    album: string;
    videoId: string;
    playlistId: string;
    mediaType: string;
    tags: string[];
}

interface PlayerState {
    song: Song | null;
    isPaused: boolean;
    shuffle: boolean;
    repeat: Repeat;
}

export type Repeat = "NONE" | "ALL" | "ONE";

export const playerState: PlayerState = {
    song: null,
    isPaused: true,
    shuffle: false,
    repeat: "NONE"
};

export const togglePlayback = async () => {
    await fetchApi("/toggle-play", { method: "POST" })
        .then(() => {
            playerState.isPaused = !playerState.isPaused;
        });
};

export const nextSong = async () => {
    await fetchApi("/next", { method: "POST" })
        .then(async () => {
            const song: Song = await fetchApi("/song").then(res => res.json());
            playerState.song = song;
        });
};

export const previousSong = async () => {
    await fetchApi("/previous", { method: "POST" })
        .then(async () => {
            const song: Song = await fetchApi("/song").then(res => res.json());
            playerState.song = song;
        });
};

export const toggleShuffle = async () => {
    await fetchApi("/shuffle", { method: "POST" })
        .then(async () => {
            playerState.shuffle = !playerState.shuffle;
        });
};

export const toggleRepeat = async () => {
    await fetchApi("/switch-repeat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ iteration: 1 })
    }).then(async () => {
        playerState.repeat = playerState.repeat === "NONE" ? "ALL" :
            playerState.repeat === "ALL" ? "ONE"
                : "NONE";
    });
};

export const seek = async (seconds: number) => {
    await fetchApi("/seek-to", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ seconds })
    }).then(async () => {
        const song: Song = await fetchApi("/song").then(res => res.json());
        playerState.song = song;
    });
};

export const setVolume = async (volume: number) => {
    await fetchApi("/volume", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ volume })
    });
};

export const fetchApi = async (path: string, options?: RequestInit) => {
    const res = await fetch(new URL(BASE_URL + ":" + Settings.plugins.YouTubeMusicControls.port + API_PATH + path), {
        ...options,
        headers: {
            ...options?.headers
        }
    });

    if (res.ok) return res;
    else throw new Error(await res.text());
};
