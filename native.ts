/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, MediaSrc } from "@main/csp";

// allow album images to be loaded
CspPolicies["lh3.googleusercontent.com"] = MediaSrc;
