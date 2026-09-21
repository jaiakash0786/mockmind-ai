# 🧠 MockMind AI — Smart Interview Preparation Chatbot

> An AI-powered interview preparation platform that simulates real interviews with adaptive difficulty, cross-questioning, and both **voice** and **chat** interaction modes.

![MockMind](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blue?style=flat-square&logo=google)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Features

- **Subject-Wise Technical Interview** — Pick subjects (Python, DSA, SQL, ML, System Design, etc.) and practice with adaptive AI questions
- **Behavioural Interview** — Practice soft-skills (Leadership, Teamwork, Conflict Resolution, etc.) like a real HR round
- **Adaptive Difficulty** — AI auto-adjusts question complexity based on your answers
- **Cross-Questioning** — AI asks follow-up and probing questions when answers reveal gaps
- **Chat Mode** — Type your answers in a sleek chat interface
- **Voice Mode** — Speak your answers; AI reads questions aloud (no extra libraries needed)
- **Session Feedback** — Detailed end-of-session report with scores, strengths, improvement areas, and study recommendations

---

## Tech Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript (no frameworks, no build step)
- **AI Engine**: Google Gemini 2.5 Flash API
- **Voice Input**: Web Speech API (SpeechRecognition) — built into Chrome
- **Voice Output**: SpeechSynthesis API — built into all modern browsers
- **Design**: Dark Glassmorphism, CSS animations, Google Inter font
- **No backend required** — runs entirely in the browser

---

## Getting Started

### Prerequisites
- Google Chrome (recommended, required for voice mode)
- A Google Gemini API key — get one free at https://aistudio.google.com/app/apikey

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/mockmind-ai.git
cd mockmind-ai

# 2. Set up your API key
cp config.example.js config.js
```

Open `config.js` and add your API key:

```js
window.GEMINI_CONFIG = {
  apiKey: 'YOUR_GEMINI_API_KEY_HERE',
  model:  'gemini-2.5-flash'
};
```

```bash
# 3. Open index.html in Chrome — no build step needed!
```

> **Note**: `config.js` is in `.gitignore` and will never be pushed to GitHub. Your API key stays private.

---

## Project Structure

```
mockmind-ai/
├── index.html          # Main app — Setup, Chat, and Summary pages
├── style.css           # Design system — dark glassmorphism, animations
├── app.js              # Core app controller — state, routing, UI logic
├── gemini.js           # Gemini API engine — adaptive questioning & feedback
├── voice.js            # Web Speech API — mic input (STT) + TTS output
├── config.example.js   # Template for API key setup (safe to commit)
├── config.js           # Your real API key (gitignored, never committed)
└── .gitignore
```

---

## Interview Modes

### Subject-Wise Technical
Select one or multiple subjects:
Python, Java, JavaScript, TypeScript, C++, C#, DSA, SQL, Machine Learning, System Design, React, Node.js, REST APIs, DevOps, Cloud (AWS/GCP)

### Behavioural
Select from soft-skill categories:
Leadership, Teamwork, Conflict Resolution, Problem Solving, Communication, Time Management, Adaptability, Initiative, Creativity, Decision Making

---

## How Adaptive Difficulty Works

```
User answers a question
        |
Gemini evaluates answer internally (score 1-10)
        |
Score 8-10  ->  Harder question or deep cross-question
Score 5-7   ->  Same level, related question
Score 1-4   ->  Easier/foundational question
        |
Next question shown with updated difficulty badge
```

---

## Voice Mode

Uses only built-in browser APIs — no extra libraries or costs:

| Component    | Technology              |
|-------------|------------------------|
| Mic to Text  | SpeechRecognition API  |
| Text to Speech | SpeechSynthesis API  |
| Auto-submit  | 2.5s silence detection |

Best supported in: Google Chrome and Microsoft Edge

---

## API Key Security

- Your Gemini API key lives only in `config.js` which is gitignored
- `config.example.js` (with a placeholder) is what gets committed to GitHub
- Anyone cloning the repo must supply their own API key

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

1. Fork the repo
2. Create your branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

Made with using Google Gemini AI
