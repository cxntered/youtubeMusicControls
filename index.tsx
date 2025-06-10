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
            default: 26538,
            min: 1,
            max: 65535
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
            find: "this.isCopiedStreakGodlike",
            replacement: {
                // react.jsx)(AccountPanel, { ..., showTaglessAccountPanel: blah })
                match: /(?<=\i\.jsxs?\)\()(\i),{(?=[^}]*?userTag:\i,hidePrivateData:)/,
                // react.jsx(WrapperComponent, { VencordOriginal: AccountPanel, ...
                replace: "$self.PanelWrapper,{VencordOriginal:$1,"
            }
        }
    ],

    start: () => toggleHoverControls(Settings.plugins.YouTubeMusicControls.hoverControls),

    PanelWrapper({ VencordOriginal, ...props }) {
        return (
            <>
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

                <VencordOriginal {...props} />
            </>
        );
    }
});
