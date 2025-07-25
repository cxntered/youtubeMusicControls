/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { showNotification } from "@api/Notifications";
import { proxyLazy } from "@utils/lazy";
import { Logger } from "@utils/Logger";
import { Flux, FluxDispatcher } from "@webpack/common";
import { Settings } from "Vencord";

import { API_VERSION, BASE_URL } from "./constants";

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

export type Repeat = "NONE" | "ALL" | "ONE";

const getApiHost = () => `${BASE_URL}:${Settings.plugins.YouTubeMusicControls.port}`;

export const YouTubeMusicStore = proxyLazy(() => {
    const { Store } = Flux;

    class YouTubeMusicStore extends Store {
        public song: Song | null = null;
        public isPaused = true;
        public shuffle = false;
        public repeat: Repeat = "NONE";

        private accessToken: string | null | undefined = undefined;
        private isAuthenticating = false;
        private reconnectAttempts = 0;

        async togglePlayback() {
            await this.fetchApi("/toggle-play", { method: "POST" });
            this.isPaused = !this.isPaused;
            this.emitChange();
        }

        async nextSong() {
            await this.fetchApi("/next", { method: "POST" });
            this.song = { ...this.song!, elapsedSeconds: 0 };
            this.isPaused = false;
            this.emitChange();

            // waits 1500 ms because /song endpoint is not updated immediately
            setTimeout(() => {
                this.fetchApi("/song").then(res => res.json()).then(song => {
                    this.song = song;
                    this.emitChange();
                });
            }, 1500);
        }

        async previousSong() {
            await this.fetchApi("/previous", { method: "POST" });
            this.song = { ...this.song!, elapsedSeconds: 0 };
            this.emitChange();

            // waits 1500 ms because /song endpoint is not updated immediately
            setTimeout(() => {
                this.fetchApi("/song").then(res => res.json()).then(song => {
                    this.song = song;
                    this.emitChange();
                });
            }, 1500);
        }

        async toggleShuffle() {
            await this.fetchApi("/shuffle", { method: "POST" });
            this.shuffle = !this.shuffle;
            this.emitChange();
        }

        async toggleRepeat() {
            await this.fetchApi("/switch-repeat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ iteration: 1 })
            });
            this.repeat = this.repeat === "NONE" ? "ALL" : this.repeat === "ALL" ? "ONE" : "NONE";
            this.emitChange();
        }

        async seek(seconds: number) {
            await this.fetchApi("/seek-to", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seconds })
            });
            this.song = { ...this.song!, elapsedSeconds: seconds };
            this.emitChange();

            // waits 1500 ms because /song endpoint is not updated immediately
            setTimeout(() => {
                this.fetchApi("/song").then(res => res.json()).then(song => {
                    this.song = song;
                    this.emitChange();
                });
            }, 1500);
        }

        async setVolume(volume: number) {
            await this.fetchApi("/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume })
            });
            this.emitChange();
        }

        async refreshState() {
            const songData = await this.fetchApi("/song").then(res => res.json());
            this.song = songData;
            this.isPaused = songData.isPaused;

            const [shuffle, repeat] = await Promise.all([
                this.fetchApi("/shuffle").then(res => res.json()),
                this.fetchApi("/repeat-mode").then(res => res.json())
            ]);
            this.shuffle = shuffle.state;
            this.repeat = repeat.mode;
            this.emitChange();
        }

        async fetchApi(path: string, options?: RequestInit) {
            const apiBase = `${getApiHost()}/api/${API_VERSION}`;

            let res = await this.makeRequest(apiBase + path, options);

            if (res.status === 401) {
                await this.authenticate();
                res = await this.makeRequest(apiBase + path, options);
            }

            if (res.ok) return res;
            else throw new Error(await res.text());
        }

        private async makeRequest(url: string, options?: RequestInit) {
            const headers = new Headers(options?.headers);

            if (this.accessToken === undefined) {
                this.accessToken = (await DataStore.get("YouTubeMusicControls_accessToken")) ?? null;
            }

            if (this.accessToken) {
                headers.set("Authorization", `Bearer ${this.accessToken}`);
            }

            return await fetch(new URL(url), {
                ...options,
                headers
            });
        }

        private async authenticate() {
            if (this.isAuthenticating) return;

            this.isAuthenticating = true;
            try {
                const res = await fetch(new URL(`${getApiHost()}/auth/YouTubeMusicControls`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });

                if (res.ok) {
                    const authData = await res.json();
                    this.accessToken = authData.accessToken;
                    await DataStore.set("YouTubeMusicControls_accessToken", authData.accessToken);
                } else {
                    throw new Error("Authentication failed");
                }
            } catch (error) {
                showNotification({
                    title: "YouTubeMusicControls",
                    body: "Authentication failed. Did you deny the request?",
                    color: "var(--status-danger, red)",
                    noPersist: true
                });
                new Logger("YouTubeMusicControls").error(error);
                this.accessToken = null;
                await DataStore.del("YouTubeMusicControls_accessToken");
            } finally {
                this.isAuthenticating = false;
            }
        }

        async startPolling() {
            try {
                await this.refreshState();
                this.reconnectAttempts = 0;
                setTimeout(() => this.startPolling(), Settings.plugins.YouTubeMusicControls.pollInterval);
            } catch (e) {
                const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, Settings.plugins.YouTubeMusicControls.maxReconnectDelay);
                new Logger("YouTubeMusicControls").warn("Failed to refresh state, retrying in", delay, "ms");
                this.reconnectAttempts++;
                setTimeout(() => this.startPolling(), delay);
            }
        }
    }

    const store = new YouTubeMusicStore(FluxDispatcher, {});
    store.startPolling();
    return store;
});
