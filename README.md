<div align="center">

# `YouTubeMusicControls`

A [Vencord](https://vencord.dev) plugin that adds a [YouTube Music](https://music.youtube.com) player above the account panel in Discord.

Based on the [SpotifyControls](https://vencord.dev/plugins/SpotifyControls) plugin built into Vencord. <br />
**Requires [Pear Desktop](https://github.com/pear-devs/pear-desktop)** (f.k.a. YouTube Music Desktop App) **to be running.**

![Showcase](images/showcase.png)

</div>

## Usage

Firstly, make sure you are using the latest release of [Pear Desktop](https://github.com/pear-devs/pear-desktop/releases/latest). Enable the `API Server [Beta]` plugin, set the "Authorization strategy" to either "No authorization" (recommended) or "Authorize at first request" and keep all other settings as default.

Then, following [this guide](https://docs.vencord.dev/installing/custom-plugins) to setup Vencord for custom plugins, `git clone` this repository into the `src/userplugins` directory of your Vencord installation, run `pnpm build` to build Vencord, inject with `pnpm inject`, and restart Discord.

After that, you can enable the plugin in the Vencord settings under "Plugins" and it should start working, as long as you have Pear Desktop running.

## Questions and Answers

### Why does the player not show up?

Make sure the `API Server [Beta]` plugin is enabled, and that its using the following settings:

- **Hostname:** `0.0.0.0`
- **Port:** `26538`

If you have the authorization strategy set to "Authorize at first request", make sure to accept the authorization request in the Pear Desktop pop-up when prompted, and if you are using a different port, you can change it in the plugin settings. If it still doesn't work, [make an issue](https://github.com/cxntered/youtubeMusicControls/issues).

### How do I style the player?

The player uses the exact same styles as the `SpotifyControls` plugin, except every instance of `spotify` is renamed to `ytmusic`.

## Disclaimer

This is my first Vencord plugin, so it is probably (definitely) not the best code ever. If you have any issues, suggestions or improvements, feel free to [open an issue](https://github.com/cxntered/youtubeMusicControls/issues) or [make a pull request](https://github.com/cxntered/youtubeMusicControls/pulls).

## To Do

- [x] ~~PR a websocket API to YTMD~~ ([someone else did this](https://github.com/pear-devs/pear-desktop/pull/3707) :p) and use that instead of polling
- [x] Allow using "Authorize at first request" as an authorization strategy
- [x] Merge pre- and post-visual refresh styles
- [x] Poll less frequently if API server isn't running
- [x] Add compatibility with `SpotifyControls`
- [x] Clean up code
- [x] Add a setting to change the polling interval
