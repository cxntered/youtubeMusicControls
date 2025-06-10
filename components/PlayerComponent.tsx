/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../styles/ytMusicStyles.css";

import { Settings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { Flex } from "@components/Flex";
import { ImageIcon, LinkIcon, OpenExternalIcon } from "@components/Icons";
import { debounce } from "@shared/debounce";
import { openImageModal } from "@utils/discord";
import { classes, copyWithToast } from "@utils/misc";
import { ContextMenuApi, FluxDispatcher, Forms, Menu, React, useEffect, useState } from "@webpack/common";

import { fetchApi, nextSong, playerState, previousSong, Repeat, seek, setVolume, Song, togglePlayback, toggleRepeat, toggleShuffle } from "../api";
import { SeekBar } from "./SeekBar";

const cl = classNameFactory("vc-ytmusic-");

function msToHuman(ms: number) {
    const minutes = ms / 1000 / 60;
    const m = Math.floor(minutes);
    const s = Math.floor((minutes - m) * 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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

function CopyContextMenu({ name, url }: { name: string; url: string; }) {
    const copyId = `ytmusic-copy-${name}`;
    const openId = `ytmusic-open-${name}`;

    return (
        <Menu.Menu
            navId={`ytmusic-${name}-menu`}
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label={`YouTube Music ${name} Menu`}
        >
            <Menu.MenuItem
                key={copyId}
                id={copyId}
                label={`Copy ${name} Link`}
                action={() => copyWithToast(url)}
                icon={LinkIcon}
            />
            <Menu.MenuItem
                key={openId}
                id={openId}
                label={`Open ${name} in YouTube Music`}
                action={() => VencordNative.native.openExternal(url)}
                icon={OpenExternalIcon}
            />
        </Menu.Menu>
    );
}

function makeContextMenu(name: string, url: string) {
    return (e: React.MouseEvent<HTMLElement, MouseEvent>) =>
        ContextMenuApi.openContextMenu(e, () => <CopyContextMenu name={name} url={url} />);
}

function Controls() {
    const { isPaused, shuffle, repeat } = playerState;

    const repeatClassName = (() => {
        switch (repeat) {
            case "NONE": return "repeat-off";
            case "ALL": return "repeat-context";
            case "ONE": return "repeat-track";
            default: throw new Error(`Invalid repeat state ${repeat}`);
        }
    })();

    // the 1 is using position absolute so it does not make the button jump around
    return (
        <Flex className={cl("button-row")} style={{ gap: 0 }}>
            <Button
                className={classes(cl("button"), cl("shuffle"), cl(shuffle ? "shuffle-on" : "shuffle-off"))}
                onClick={() => toggleShuffle()}
            >
                <Shuffle />
            </Button>
            <Button onClick={() => previousSong()}>
                <SkipPrev />
            </Button>
            <Button onClick={() => togglePlayback()}>
                {isPaused ? <PlayButton /> : <PauseButton />}
            </Button>
            <Button onClick={() => nextSong()}>
                <SkipNext />
            </Button>
            <Button
                className={classes(cl("button"), cl("repeat"), cl(repeatClassName))}
                onClick={() => toggleRepeat()}
                style={{ position: "relative" }}
            >
                {repeat === "ONE" && <span className={cl("repeat-1")}>1</span>}
                <Repeat />
            </Button>
        </Flex>
    );
}

function YouTubeMusicSeekBar({ song }: { song: Song; }) {
    const { songDuration, elapsedSeconds, isPaused } = song;
    const [position, setPosition] = useState(elapsedSeconds * 1000);

    useEffect(() => {
        setPosition(elapsedSeconds * 1000);

        if (!isPaused && Settings.plugins.YouTubeMusicControls.pollInterval !== 1000) {
            const interval = setInterval(() => {
                setPosition(p => p + 1000);
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [elapsedSeconds, isPaused]);

    const onChange = (v: number) => {
        setPosition(v);
        debounce((value: number) => {
            seek(value / 1000);
        })(v);
    };

    return (
        <div id={cl("progress-bar")}>
            <Forms.FormText
                variant="text-xs/medium"
                className={cl("progress-time") + " " + cl("time-left")}
                aria-label="Progress"
            >
                {msToHuman(position)}
            </Forms.FormText>
            <SeekBar
                initialValue={position}
                minValue={0}
                maxValue={songDuration * 1000}
                onValueChange={onChange}
                asValueChanges={onChange}
                onValueRender={msToHuman}
            />
            <Forms.FormText
                variant="text-xs/medium"
                className={cl("progress-time") + " " + cl("time-right")}
                aria-label="Total Duration"
            >
                {msToHuman(songDuration * 1000)}
            </Forms.FormText>
        </div>
    );
}

function AlbumContextMenu({ song }: { song: Song; }) {
    const [volume, setVolumeState] = useState<number | null>(null);

    useEffect(() => {
        fetchApi("/volume")
            .then(res => res.json())
            .then(({ state }) => setVolumeState(state));
    }, []);

    if (volume === null) return null;

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
                action={() => openImageModal({ url: song.imageSrc })}
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
                        onChange={debounce((v: number) => setVolume(v))}
                    />
                )}
            />
        </Menu.Menu>
    );
}

function makeLinkProps(name: string, url: string) {
    return {
        role: "link",
        onClick: () => VencordNative.native.openExternal(url),
        onContextMenu: makeContextMenu(name, url)
    } satisfies React.HTMLAttributes<HTMLElement>;
}

function Info({ song }: { song: Song; }) {
    const img = song.imageSrc;

    const [coverExpanded, setCoverExpanded] = useState(false);

    const i = (
        <>
            {img && (
                <img
                    id={cl("album-image")}
                    src={img}
                    alt="Album Image"
                    onClick={() => setCoverExpanded(!coverExpanded)}
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
                <Forms.FormText
                    variant="text-sm/semibold"
                    id={cl("song-title")}
                    className={cl("ellipoverflow")}
                    title={song.title}
                    {...makeLinkProps("Song", song.url)}
                >
                    {song.title}
                </Forms.FormText>
                {song.artist && (
                    <Forms.FormText variant="text-sm/normal" className={cl(["ellipoverflow", "secondary-song-info"])}>
                        <span className={cl("song-info-prefix")}>by&nbsp;</span>
                        <span className={cl("artist")} style={{ fontSize: "inherit" }} title={song.artist}>
                            {song.artist}
                        </span>
                    </Forms.FormText>
                )}
                {song.album && (
                    <Forms.FormText variant="text-sm/normal" className={cl(["ellipoverflow", "secondary-song-info"])}>
                        <span className={cl("song-info-prefix")}>on&nbsp;</span>
                        <span
                            id={cl("album-title")}
                            className={cl("album")}
                            style={{ fontSize: "inherit" }}
                            title={song.album}
                        >
                            {song.album}
                        </span>
                    </Forms.FormText>
                )}
            </div>
        </div>
    );
}

export function Player() {
    const [isPaused, setIsPaused] = useState(playerState.isPaused);
    const [song, setSong] = useState(playerState.song);
    const [shouldHide, setShouldHide] = useState(false);

    // hide player after 5 minutes of inactivity
    useEffect(() => {
        setShouldHide(false);
        if (isPaused) {
            const timeout = setTimeout(() => setShouldHide(true), 1000 * 60 * 5);
            return () => clearTimeout(timeout);
        }
    }, [isPaused]);

    // refresh player state every pollInterval
    useEffect(() => {
        const interval = setInterval(async () => {
            const [songData, shuffle, repeat] = await Promise.all([
                fetchApi("/song").then(res => res.json()),
                fetchApi("/shuffle").then(res => res.json()),
                fetchApi("/repeat-mode").then(res => res.json())
            ]);

            Object.assign(playerState, {
                song: songData,
                isPaused: songData.isPaused,
                shuffle: shuffle.state,
                repeat: repeat.mode
            });

            setSong(songData);
            setIsPaused(songData.isPaused);
        }, Settings.plugins.YouTubeMusicControls.pollInterval);

        return () => clearInterval(interval);
    }, [Settings.plugins.YouTubeMusicControls.pollInterval]);

    if (!song || shouldHide)
        return null;

    const exportTrackImageStyle = {
        "--vc-ytmusic-track-image": `url(${song?.imageSrc || ""})`,
    } as React.CSSProperties;

    return (
        <div id={cl("player")} style={exportTrackImageStyle}>
            <Info song={song} />
            <YouTubeMusicSeekBar song={song} />
            <Controls />
        </div>
    );
}
