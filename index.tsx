/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import { Player } from "./components/PlayerComponent";
import hoverOnlyStyle from "./styles/hoverOnly.css?managed";

function toggleHoverControls(value: boolean) {
    (value ? enableStyle : disableStyle)(hoverOnlyStyle);
}

export default definePlugin({
    name: "YouTubeMusicControls",
    description: "Adds a YouTube Music player above the account panel. Based on the SpotifyControls plugin.",
    authors: [Devs.Ven, Devs.afn, Devs.KraXen72, Devs.Av32000, Devs.nin0dev, { name: "cxntered", id: 638695599893643274n }],
    options: {
        port: {
            description: "YouTube Music API server's port",
            type: OptionType.NUMBER,
            default: 26538
        },
        pollInterval: {
            description: "Polling interval (in milliseconds) to update the player state",
            type: OptionType.NUMBER,
            default: 5000
        },
        maxReconnectDelay: {
            description: "Maximum delay (in milliseconds) between reconnection attempts",
            type: OptionType.NUMBER,
            default: 15000
        },
        expandCover: {
            description: "Expand the song cover image on click",
            type: OptionType.BOOLEAN,
            default: true
        },
        hoverControls: {
            description: "Show controls on hover",
            type: OptionType.BOOLEAN,
            default: false,
            onChange: v => toggleHoverControls(v)
        }
    },
    patches: [
        {
            find: 'setProperty("--custom-app-panels-height"',
            replacement: {
                match: /(\(0,\i\.jsx\))\(\i\.Z,\{section:\i.\i.ACCOUNT_PANEL/,
                replace: "$1($self.Panel, {}), $&"
            }
        }
    ],

    start: () => toggleHoverControls(Settings.plugins.YouTubeMusicControls.hoverControls),

    Panel() {
        return (
            <ErrorBoundary
                fallback={() => (
                    <div className="vc-ytmusic-fallback">
                        <p>Failed to render YouTube Music Modal :(</p>
                        <p>Check the console for errors</p>
                    </div>
                )}
            >
                <Player />
            </ErrorBoundary>
        );
    }
});
