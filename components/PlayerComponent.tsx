/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../styles/ytMusicStyles.css";

import { classNameFactory } from "@api/Styles";
import { Flex } from "@components/Flex";
import { CopyIcon, ImageIcon, LinkIcon, OpenExternalIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { debounce } from "@shared/debounce";
import { openImageModal } from "@utils/discord";
import { classes, copyWithToast } from "@utils/misc";
import { ContextMenuApi, FluxDispatcher, Menu, React, useEffect, useState, useStateFromStores } from "@webpack/common";

import { settings } from "..";
import { SongInfo } from "../lib/types";
import { YouTubeMusicStore } from "../lib/YouTubeMusicStore";
import { SeekBar } from "./SeekBar";

const cl = classNameFactory("vc-ytmusic-");

function formatSeconds(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function Svg(path: string, label: string) {
    return () => (
        <svg
            className={cl("button-icon", label)}
            height="24"
            width="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label={label}
            focusable={false}
        >
            <path d={path} />
        </svg>
    );
}

/*
 * KraXen's icons :yesyes:
 * from https://fonts.google.com/icons?icon.style=Rounded&icon.set=Material+Icons
 * older material icon style, but still really good
 */
const PlayButton = Svg("M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z", "play");
const PauseButton = Svg("M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z", "pause");
const SkipPrev = Svg("M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z", "previous");
const SkipNext = Svg("M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z", "next");
const Repeat = Svg("M7 7h10v1.79c0 .45.54.67.85.35l2.79-2.79c.2-.2.2-.51 0-.71l-2.79-2.79c-.31-.31-.85-.09-.85.36V5H6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1V7zm10 10H7v-1.79c0-.45-.54-.67-.85-.35l-2.79 2.79c-.2.2-.2.51 0 .71l2.79 2.79c.31.31.85.09.85-.36V19h11c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1s-1 .45-1 1v3z", "repeat");
const Shuffle = Svg("M10.59 9.17L6.12 4.7c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.46 4.46 1.42-1.4zm4.76-4.32l1.19 1.19L4.7 17.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L17.96 7.46l1.19 1.19c.31.31.85.09.85-.36V4.5c0-.28-.22-.5-.5-.5h-3.79c-.45 0-.67.54-.36.85zm-.52 8.56l-1.41 1.41 3.13 3.13-1.2 1.2c-.31.31-.09.85.36.85h3.79c.28 0 .5-.22.5-.5v-3.79c0-.45-.54-.67-.85-.35l-1.19 1.19-3.13-3.14z", "shuffle");

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={cl("button")}
            {...props}
        >
            {props.children}
        </button>
    );
}

function CopyContextMenu({ name, type, path }: { type: string; name: string; path?: string; }) {
    return (
        <Menu.Menu
            navId={"vc-ytmusic-menu"}
            onClose={ContextMenuApi.closeContextMenu}
            aria-label={`YouTube Music ${name} Menu`}
        >
            <Menu.MenuItem
                id="vc-ytmusic-copy-name"
                label={`Copy ${type} Name`}
                action={() => copyWithToast(name)}
                icon={CopyIcon}
            />
            {path && <Menu.MenuItem
                id="vc-ytmusic-copy-link"
                label={`Copy ${type} Link`}
                action={() => copyWithToast(path)}
                icon={LinkIcon}
            />}
            {path && <Menu.MenuItem
                id="vc-ytmusic-open"
                label={`Open ${type} in YouTube Music`}
                action={() => VencordNative.native.openExternal(path)}
                icon={OpenExternalIcon}
            />}
        </Menu.Menu>
    );
}

function Controls() {
    const [isPlaying, shuffle, repeat] = useStateFromStores(
        [YouTubeMusicStore],
        () => [YouTubeMusicStore.isPlaying, YouTubeMusicStore.shuffle, YouTubeMusicStore.repeat]
    );

    const repeatClassName = (() => {
        switch (repeat) {
            case "ALL": return "repeat-context";
            case "ONE": return "repeat-track";
            default: case "NONE": return "repeat-off";
        }
    })();

    // the 1 is using position absolute so it does not make the button jump around
    return (
        <Flex className={cl("button-row")} style={{ gap: 0 }}>
            <Button
                className={classes(cl("button"), cl("shuffle"), cl(shuffle ? "shuffle-on" : "shuffle-off"))}
                onClick={() => YouTubeMusicStore.toggleShuffle()}
            >
                <Shuffle />
            </Button>
            <Button onClick={() => YouTubeMusicStore.previousSong()}>
                <SkipPrev />
            </Button>
            <Button onClick={() => YouTubeMusicStore.togglePlayback()}>
                {isPlaying ? <PauseButton /> : <PlayButton />}
            </Button>
            <Button onClick={() => YouTubeMusicStore.nextSong()}>
                <SkipNext />
            </Button>
            <Button
                className={classes(cl("button"), cl("repeat"), cl(repeatClassName))}
                onClick={() => YouTubeMusicStore.toggleRepeat()}
                style={{ position: "relative" }}
            >
                {repeat === "ONE" && <span className={cl("repeat-1")}>1</span>}
                <Repeat />
            </Button>
        </Flex>
    );
}

const debouncedSeek = debounce((v: number) => {
    YouTubeMusicStore.seek(v);
});

function YouTubeMusicSeekBar() {
    const { songDuration } = YouTubeMusicStore.song!;
    const [storePosition] = useStateFromStores(
        [YouTubeMusicStore],
        () => [YouTubeMusicStore.position]
    );

    const [position, setPosition] = useState(storePosition);

    useEffect(() => {
        setPosition(storePosition);
    }, [storePosition]);

    const onChange = (v: number) => {
        setPosition(v);
        debouncedSeek(v);
    };

    return (
        <div id={cl("progress-bar")}>
            <Span
                size="xs"
                weight="medium"
                className={cl("progress-time") + " " + cl("time-left")}
                aria-label="Progress"
            >
                {formatSeconds(position)}
            </Span>
            <SeekBar
                initialValue={position}
                minValue={0}
                maxValue={songDuration}
                onValueChange={onChange}
                asValueChanges={onChange}
                onValueRender={formatSeconds}
            />
            <Span
                size="xs"
                weight="medium"
                className={cl("progress-time") + " " + cl("time-right")}
                aria-label="Total Duration"
            >
                {formatSeconds(songDuration)}
            </Span>
        </div>
    );
}

function AlbumContextMenu({ song }: { song: SongInfo; }) {
    const [volume, muted] = useStateFromStores(
        [YouTubeMusicStore],
        () => [YouTubeMusicStore.volume, YouTubeMusicStore.muted]
    );

    return (
        <Menu.Menu
            navId="ytmusic-album-menu"
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label="YouTube Music Album Menu"
        >
            <Menu.MenuItem
                key="view-cover"
                id="view-cover"
                label="View Album Cover"
                action={() => song.imageSrc && openImageModal({ url: song.imageSrc })}
                icon={ImageIcon}
            />
            <Menu.MenuControlItem
                id="ytmusic-volume"
                key="ytmusic-volume"
                label="Volume"
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        {...props}
                        ref={ref}
                        value={volume}
                        minValue={0}
                        maxValue={100}
                        onChange={debounce((v: number) => YouTubeMusicStore.setVolume(v))}
                    />
                )}
            />
            <Menu.MenuCheckboxItem
                id="ytmusic-mute"
                key="ytmusic-mute"
                label="Mute"
                checked={muted}
                action={() => YouTubeMusicStore.toggleMute()}
            />
        </Menu.Menu>
    );
}

function makeLinkProps(type: "Song" | "Artist" | "Album", name: string, path?: string) {
    if (!path) return {
        onContextMenu: e =>
            ContextMenuApi.openContextMenu(e, () => <CopyContextMenu type={type} name={name} />)
    } satisfies React.HTMLAttributes<HTMLElement>;

    return {
        role: "link",
        onClick: () => VencordNative.native.openExternal(path),
        onContextMenu: e =>
            ContextMenuApi.openContextMenu(e, () => <CopyContextMenu type={type} name={name} path={path} />)
    } satisfies React.HTMLAttributes<HTMLElement>;
}

function Info({ song }: { song: SongInfo; }) {
    const img = song.imageSrc;

    const [coverExpanded, setCoverExpanded] = useState(false);

    const i = (
        <>
            {img && (
                <img
                    id={cl("album-image")}
                    src={img}
                    alt="Album Image"
                    onClick={() => settings.store.expandCover && setCoverExpanded(!coverExpanded)}
                    onContextMenu={e => {
                        ContextMenuApi.openContextMenu(e, () => <AlbumContextMenu song={song} />);
                    }}
                />
            )}
        </>
    );

    if (coverExpanded && img)
        return (
            <div id={cl("album-expanded-wrapper")}>
                {i}
            </div>
        );

    return (
        <div id={cl("info-wrapper")}>
            {i}
            <div id={cl("titles")}>
                <Paragraph
                    weight="semibold"
                    id={cl("song-title")}
                    className={cl("ellipoverflow")}
                    title={song.title}
                    {...makeLinkProps("Song", song.title, song.url)}
                >
                    {song.title}
                </Paragraph>
                {song.artist && (
                    <Paragraph className={cl(["ellipoverflow", "secondary-song-info"])}>
                        <span className={cl("song-info-prefix")}>by&nbsp;</span>
                        <span
                            className={cl("artist")}
                            style={{ fontSize: "inherit" }}
                            title={song.artist}
                            {...makeLinkProps("Artist", song.artist, song.artistUrl)}
                        >
                            {song.artist}
                        </span>
                    </Paragraph>
                )}
                {song.album && (
                    <Paragraph className={cl(["ellipoverflow", "secondary-song-info"])}>
                        <span className={cl("song-info-prefix")}>on&nbsp;</span>
                        <span
                            id={cl("album-title")}
                            className={cl("album")}
                            style={{ fontSize: "inherit" }}
                            title={song.album}
                            {...makeLinkProps("Album", song.album)}
                        >
                            {song.album}
                        </span>
                    </Paragraph>
                )}
            </div>
        </div>
    );
}

export function Player() {
    const [song, isPlaying] = useStateFromStores(
        [YouTubeMusicStore],
        () => [YouTubeMusicStore.song, YouTubeMusicStore.isPlaying]
    );

    const [shouldHide, setShouldHide] = useState(false);

    // hide player after 5 minutes of inactivity
    useEffect(() => {
        setShouldHide(false);
        if (!isPlaying) {
            const timeout = setTimeout(() => setShouldHide(true), 1000 * 60 * 5);
            return () => clearTimeout(timeout);
        }
    }, [isPlaying]);

    if (!song || shouldHide)
        return null;

    const exportTrackImageStyle = {
        "--vc-ytmusic-track-image": `url(${song?.imageSrc || ""})`,
    } as React.CSSProperties;

    return (
        <div id={cl("player")} style={exportTrackImageStyle}>
            <Info song={song} />
            <YouTubeMusicSeekBar />
            <Controls />
        </div>
    );
}
