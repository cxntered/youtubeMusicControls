/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { cl } from "./PlayerComponent";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={cl("button")}
            {...props}
        >
            {props.children}
        </button>
    );
}
