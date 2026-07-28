# Noesis 🌸

A little learning app built around one stubborn idea: you don't really know something until you can explain it out loud.

Most learning tools just let you tick boxes. Noesis doesn't. You tell it what you want to learn, it grows you a small map of the concepts, and each one stays a gray seed until you actually talk it through — like calling a friend who happens to know everything. Explain it well and it blooms into a flower. Hand-wave it and it'll tell you exactly what you missed.

The whole thing is a "garden at dusk" — a dark, quiet canvas where your knowledge literally grows into flowers as you prove you understand.

## How it works

- Type a goal — *"learn Morse code"*, *"understand WebGPU shaders"*.
- It builds a small graph of concepts, each with a couple of good resources.
- Pick one and either **call** the companion to talk it through, or **write** a quick explanation.
- What you say gets graded for real understanding — not for sounding confident.
- Nodes go **seed → sprout → bloom**. Over time you get an honest map of what you actually know.

You can also bring your own source — paste a link or upload a PDF — and it builds the path around that.

## Run it locally

```bash
npm install
npm run dev
```

Then copy `.env.example` to `.env` and add your keys.

## Built with

- Next.js + React
- react-flow for the garden canvas
- Framer Motion for the motion
- libsql / Turso for storage
- Gemini (with an OpenRouter fallback) for the thinking
- ElevenLabs for the voice — both listening and speaking

## Deploying

Runs on Vercel with a Turso database. See `.env.example` for everything to set.

---

Made by Rim.
