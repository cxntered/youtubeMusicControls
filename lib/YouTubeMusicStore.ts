/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { showNotification } from "@api/Notifications";
import { Logger } from "@utils/Logger";
import { proxyLazyWebpack } from "@webpack";
import { Flux, FluxDispatcher } from "@webpack/common";

import { settings } from "..";
import { API_HOST, API_VERSION } from "./constants";
import { DataTypes, RepeatMode, SongInfo, WebSocketMessage } from "./types";

const getApiBase = () => `${API_HOST}:${settings.store.port}`;
const logger = new Logger("YouTubeMusicControls", "red");

export const YouTubeMusicStore = proxyLazyWebpack(() => {
    const { Store } = Flux;

    class YouTubeMusicStore extends Store {
        public song: SongInfo | null = null;
        public isPlaying = false;
        public muted = false;
        public position = 0;
        public volume = 100;
        public repeat: RepeatMode = "NONE";
        public shuffle = false;

        private websocket: WebSocket | null = null;
        private isConnecting = false;
        private reconnectAttempts = 0;
        private accessToken: string | null | undefined = undefined;
        private isAuthenticating = false;

        connectWebSocket() {
            if (this.isConnecting || this.websocket?.readyState === WebSocket.OPEN) return;

            this.isConnecting = true;
            this.websocket = new WebSocket(`ws://${getApiBase()}/api/${API_VERSION}/ws`);

            this.websocket.onopen = () => {
                logger.info("Connected to WebSocket");
                this.isConnecting = false;
                this.reconnectAttempts = 0;
            };

            this.websocket.onmessage = event => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    logger.error("Failed to parse WebSocket message:", error);
                }
            };

            this.websocket.onclose = () => {
                this.isConnecting = false;
                this.websocket = null;
                this.resetPlayerState();
                this.scheduleWebSocketReconnect();
            };

            this.websocket.onerror = error => {
                logger.error("WebSocket error:", error);
                this.isConnecting = false;
                this.resetPlayerState();
            };
        }

        disconnectWebSocket() {
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
                this.resetPlayerState();
            }
        }

        async togglePlayback() {
            await this.fetchApi("/toggle-play", { method: "POST" })
                .catch(e => logger.error("Failed to toggle playback:", e));
        }

        async nextSong() {
            await this.fetchApi("/next", { method: "POST" })
                .catch(e => logger.error("Failed to skip to next song:", e));
        }

        async previousSong() {
            await this.fetchApi("/previous", { method: "POST" })
                .catch(e => logger.error("Failed to go to previous song:", e));
        }

        async toggleShuffle() {
            await this.fetchApi("/shuffle", { method: "POST" })
                .catch(e => logger.error("Failed to toggle shuffle:", e));
        }

        async toggleMute() {
            await this.fetchApi("/toggle-mute", { method: "POST" })
                .catch(e => logger.error("Failed to toggle mute:", e));
        }

        async switchRepeat() {
            await this.fetchApi("/switch-repeat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ iteration: 1 })
            }).catch(e => logger.error("Failed to switch repeat:", e));
        }

        async seek(seconds: number) {
            await this.fetchApi("/seek-to", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seconds })
            }).catch(e => logger.error("Failed to seek:", e));
        }

        async setVolume(volume: number) {
            await this.fetchApi("/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume })
            }).catch(e => logger.error("Failed to set volume:", e));
        }

        private resetPlayerState() {
            this.song = null;
            this.isPlaying = false;
            this.muted = false;
            this.position = 0;
            this.volume = 100;
            this.repeat = "NONE";
            this.shuffle = false;
            this.emitChange();
        }

        private handleWebSocketMessage(data: WebSocketMessage) {
            switch (data.type) {
                case DataTypes.PlayerInfo:
                    this.song = data.song;
                    this.isPlaying = data.isPlaying;
                    this.muted = data.muted;
                    this.position = data.position;
                    this.volume = data.volume;
                    this.repeat = data.repeat;
                    this.shuffle = data.shuffle;
                    break;

                case DataTypes.VideoChanged:
                    this.song = data.song;
                    this.position = data.position;
                    this.isPlaying = !data.song.isPaused;
                    break;

                case DataTypes.PlayerStateChanged:
                    this.isPlaying = data.isPlaying;
                    this.position = data.position;
                    break;

                case DataTypes.PositionChanged:
                    this.position = data.position;
                    break;

                case DataTypes.VolumeChanged:
                    this.volume = data.volume;
                    this.muted = data.muted;
                    break;

                case DataTypes.RepeatChanged:
                    this.repeat = data.repeat;
                    break;

                case DataTypes.ShuffleChanged:
                    this.shuffle = data.shuffle;
                    break;

                default:
                    logger.warn("Unknown WebSocket message type:", data);
                    return;
            }

            this.emitChange();
        }

        private scheduleWebSocketReconnect() {
            const delay = Math.min(2 ** this.reconnectAttempts * 1000, settings.store.maxReconnectDelay);
            logger.info(`WebSocket has been disconnected, reconnecting in ${delay}ms`);
            this.reconnectAttempts++;
            setTimeout(() => this.connectWebSocket(), delay);
        }

        private async fetchApi(path: string, options?: RequestInit) {
            const apiBase = `http://${getApiBase()}/api/${API_VERSION}`;

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

            return await fetch(url, {
                ...options,
                headers
            });
        }

        private async authenticate() {
            if (this.isAuthenticating) return;

            this.isAuthenticating = true;
            try {
                const res = await fetch(`http://${getApiBase()}/auth/YouTubeMusicControls`, {
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
                logger.error(error);
                this.accessToken = null;
                await DataStore.del("YouTubeMusicControls_accessToken");
            } finally {
                this.isAuthenticating = false;
            }
        }
    }

    const store = new YouTubeMusicStore(FluxDispatcher);
    return store;
});
