/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface SongInfo {
    title: string;
    alternativeTitle?: string;
    artist: string;
    artistUrl?: string;
    views: number;
    uploadDate?: string;
    imageSrc?: string | null;
    image?: Electron.NativeImage | null;
    isPaused?: boolean;
    songDuration: number;
    elapsedSeconds?: number;
    url?: string;
    album?: string | null;
    videoId: string;
    playlistId?: string;
    mediaType: MediaType;
    tags?: string[];
}

export enum MediaType {
    Audio = "AUDIO",
    OriginalMusicVideo = "ORIGINAL_MUSIC_VIDEO",
    UserGeneratedContent = "USER_GENERATED_CONTENT",
    PodcastEpisode = "PODCAST_EPISODE",
    OtherVideo = "OTHER_VIDEO",
}

export type RepeatMode = "NONE" | "ONE" | "ALL";

export enum DataTypes {
    PlayerInfo = "PLAYER_INFO",
    VideoChanged = "VIDEO_CHANGED",
    PlayerStateChanged = "PLAYER_STATE_CHANGED",
    PositionChanged = "POSITION_CHANGED",
    VolumeChanged = "VOLUME_CHANGED",
    RepeatChanged = "REPEAT_CHANGED",
    ShuffleChanged = "SHUFFLE_CHANGED",
}
