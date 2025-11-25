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
import { Button } from "./Button";
import { PauseButton, PlayButton, Repeat, Shuffle, SkipNext, SkipPrev } from "./Icons";
import { SeekBar } from "./SeekBar";

export const cl = classNameFactory("vc-ytmusic-");

function formatSeconds(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
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
