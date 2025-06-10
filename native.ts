/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, MediaScriptsAndCssSrc, MediaSrc } from "@main/csp";

// allow access to the youtube music desktop app API server
CspPolicies["localhost:*"] = MediaScriptsAndCssSrc;
CspPolicies["http://localhost:*"] = MediaScriptsAndCssSrc;

// allow album images to be loaded
CspPolicies["lh3.googleusercontent.com"] = MediaSrc;
