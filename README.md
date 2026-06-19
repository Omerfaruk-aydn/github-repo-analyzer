<div align="center">
  <img src="public/globe.svg" alt="RepoMind Logo" width="120" height="120" />

  # 🧠 RepoMind
  **Agentic Code Scanner & Automated Codebase Auditor**

  [![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![SQLite](https://img.shields.io/badge/SQLite-Local_DB-003B57?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

  <p align="center">
    A fully automated, AI-driven codebase auditing tool that clones, maps, and analyzes entire Git repositories using an army of specialized AI agents.
  </p>
</div>

<br />

## ✨ Key Features

- **🤖 Multi-Agent Pipeline:** Employs parallel AI agents specialized in Architecture Analysis, Security Vulnerabilities, Bug Detection, Code Improvements, and Documentation.
- **⚡ Extremely Fast Ingestion:** Clones the repository locally into a secure temporary environment, parses AST syntax, and extracts a detailed Code Map in seconds.
- **🌐 Dynamic LLM Integration:** Bring Your Own Key (BYOK) architecture. Supports all leading AI models via **OpenRouter** (GPT-4o, Claude 3.5 Sonnet, Gemini 2.0) and Local Offline Models via **Ollama**.
- **📊 Premium Interactive Dashboard:** Built with Next.js 15 App Router, React, Tailwind CSS, and Framer Motion. Features a futuristic interface with dynamic dependency graphs and actionable insights.
- **🔒 100% Privacy Focused:** Everything runs locally. Your repository data is stored in a local SQLite database (`repomind.db`) and never sent to third-party tracking servers.

---

## 📸 Interface Sneak Peek

*RepoMind features a sleek, glass-morphism inspired dashboard that renders your codebase as an interactive dependency matrix while streaming live findings from AI agents.*

> **Dashboard:** Actionable security, bug, and architectural insights at a glance.
> **Dependency Graph:** Visualizes import pipelines using a real-time Mermaid/SVG interactive diagram.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.17 or higher)
- [Git](https://git-scm.com/)
- An API Key from [OpenRouter](https://openrouter.ai/) (Optional, but recommended for cloud models)
- [Ollama](https://ollama.com/) (Optional, for 100% offline local analysis)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Omerfaruk-aydn/github-repo-analyzer.git
   cd github-repo-analyzer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open the interface:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧠 How It Works

1. **URL Submission:** Enter any valid public GitHub repository URL (e.g., `https://github.com/owner/repo`). 
2. **Ingestion & AST Mapping:** RepoMind automatically clones the repository, traverses the directory tree, ignores `.git` and `node_modules`, and generates a high-level Entity Map.
3. **Agentic Delegation:** 
   - 🏗️ **Architecture Agent:** Analyzes overall design patterns and tech stack.
   - 🛡️ **Security Agent:** Scans for potential vulnerabilities and attack vectors.
   - 🐛 **Bug Agent:** Detects logic errors, race conditions, and unhandled exceptions.
   - 💡 **Suggestion Agent:** Proposes refactoring and clean-code improvements.
4. **Final Report:** The results are beautifully rendered in the Dashboard, highlighting critical issues and summarizing the entire project.

---

## 🛠️ Technology Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS + Framer Motion |
| **Database** | `node:sqlite` (Native SQLite Sync) |
| **AI Integration** | Fetch API (OpenRouter & Ollama) |
| **Icons** | Lucide React |

---

## 🛡️ Security & Privacy Notice

**Please Note:** RepoMind handles sensitive source code. The application is designed to be run **locally**.
- **API Keys** are saved locally in the SQLite database and are **never** transmitted to any server other than the LLM provider you choose (e.g., OpenRouter).
- **Source Code** is cloned to a temporary directory (`src/tmp/`) and deleted automatically after the context map is generated.
- Ensure your `.gitignore` is intact before deploying or committing your local `repomind.db`.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/Omerfaruk-aydn/github-repo-analyzer/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">
  Built with ❤️ by the open-source community.
</p>
