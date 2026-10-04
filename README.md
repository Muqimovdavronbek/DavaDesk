<div align="center">

![DavaDesk — AI, one click away](docs/images/cover.webp)

# DavaDesk
### Your desktop. Your AI. Always within reach.

An animated desktop companion for **Windows and Linux**, with quick access to **11 AI services**.

[O‘zbekcha qo‘llanma](README_UZ.md) · [Installation](docs/INSTALL.md) · [Screenshots](docs/SCREENSHOTS.md) · [Release notes](CHANGELOG.md)

**v1.5.0 · MIT · Electron · Windows x64 / Linux**

</div>

## Meet your desktop companion

DavaDesk brings an animated companion to your desktop. Click to open the assistant, drag it to a convenient corner, and move the pointer away to collapse the panel. Choose an AI service, continue a conversation, or drop a file onto the companion to start attaching it.

![Home interface](docs/images/home.webp)

## What you can do

- **Keep an assistant nearby:** animated mascot, draggable position, edge snapping and always-on-top setting.
- **Choose your AI:** ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, DeepSeek, Grok, Le Chat, Qwen, Kimi and Poe.
- **Drop files into a conversation:** images, documents and ZIP files, subject to the selected service’s supported types and limits.
- **Make it yours:** first-run name setup and an editable local profile.
- **Work with a local folder:** optional Codex tasks with an explicit workspace and permission mode.
- **Open it quickly:** click the mascot or use Ctrl+Alt+Space when available.

## Download and install

[**Download Windows & Linux / Yuklab olish →**](https://github.com/Muqimovdavronbek/DavaDesk/releases/tag/v1.5.0)

Release packages belong under this repository’s **Releases** section. Choose the complete asset, rather than GitHub’s automatically generated source archive, when you want the Windows executable.

| System | Package | Start here |
| --- | --- | --- |
| Windows 10/11 x64 | `DavaDesk_Windows_x64_v1.5.0.zip` | Extract All → open `DavaDesk.exe`. No separate Node.js installation. |
| Linux desktop | `DavaDesk_Linux_v1.5.0.zip` | Install Node.js 22+, npm and wmctrl → extract → `bash install.sh`. |

See [the complete installation guide](docs/INSTALL.md) for prerequisites, updates, virtual desktops and troubleshooting.

## Accounts and file handling

Each AI provider requires its own sign-in. The same email may be used where supported, but DavaDesk does not provide a shared login across companies. Sessions are stored separately. Provider subscriptions, quotas and availability still apply.

Dropping a file can start an upload to the selected provider. DavaDesk does **not** press Send automatically. Check the provider’s upload result before sending your message. Automatic attachment depends on the provider’s website and may require manual attachment. Local tasks use Codex; the other integrations open provider websites.

## Platform support and validation

Windows portable runtime: Electron 44.5.1 and Codex 0.160.0, x64. Linux installs dependencies through npm. The Windows package is a portable folder, not an MSI installer.

45 automated tests passed during preparation. Native Windows operation, real GNOME/Wayland workspace behavior and uploads to live AI accounts have **not** been verified in this build environment. Screenshots show the real renderer with sample local state; they are not proof of native OS or provider integration tests.

Windows virtual desktops require **Win+Tab → right-click DavaDesk → Show this window on all desktops**. Linux uses X11/XWayland and wmctrl where available. Fullscreen applications and window managers can affect visibility.

## Development

```bash
npm install
npm run check
npm test
npm start
```

Use Node.js 22 or newer. Linux users should normally start through `bash launch.sh` after installation. Never launch the Linux application with sudo.

## Contributing and license

Bug reports should include the app version, OS, desktop environment, exact steps and any error text. Remove personal details from screenshots and logs. See [CONTRIBUTING.md](CONTRIBUTING.md).

DavaDesk source is [MIT licensed](LICENSE). Bundled third-party software retains its own license and notices. This is an independent project, not an official application from any listed AI provider.
