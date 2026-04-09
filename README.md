# Fluxy

A premium game hub web application with thousands of HTML games, realtime chat, and a beautiful glassmorphism UI.

## Tech Stack

- **Frontend**: React 18 + Vite + React Router
- **Backend**: Node.js + Express + Socket.io
- **UI**: Glassmorphism design with 10 custom themes
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+

### Install & Run

1. **Install server dependencies:**

```bash
cd Server
npm install
```

2. **Install client dependencies:**

```bash
cd Client
npm install
```

3. **Start the server** (from `Server/`):

```bash
npm run dev
```

4. **Start the client** (from `Client/`):

```bash
npm run dev
```

5. Open `http://localhost:5173` in your browser.

## Project Structure

```
FluxyV3/
├── Client/               # React frontend (Vite)
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route pages
│       ├── themes/       # Theme system (10 themes)
│       └── utils/        # API helpers & localStorage utils
├── Server/               # Express + Socket.io backend
│   ├── index.js          # Server entry point
│   └── routes/           # API route handlers
└── UGS Files/            # HTML game files (served statically)
```

## Features

- **Home**: Featured games, trending section, recently played
- **Games**: 2700+ games with search, category filters, infinite scroll
- **Chat**: Realtime messaging with Socket.io
- **Settings**: 10 themes, sidebar/taskbar toggle, proxy engine UI
- **Game Player**: Iframe-based game loader with fullscreen support

## Themes

Glassy (default), Moonlight, Haze, Steel, Blossom, Obsidian, NeonGrid, Aurora, Carbon, Solar
