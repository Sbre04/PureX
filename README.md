# Pure X - AI Forensic Sentinel 🛡️

> **System Architect:** Davide De Rosa  
> **Version:** v22.0 (Stable)

**Pure X** is an advanced browser extension designed to detect, highlight, and manage AI-generated content on X (formerly Twitter). It uses forensic text analysis (rhythm, structure, sentiment) to identify LLM patterns like GPT-4, Claude, and Gemini.

[👉 View Tweet on X](https://twitter.com/Davide_derosaa/status/2005449683452428328)

## 🚀 Features

-   **🧠 Forensic Analysis Engine:** Detects robotic neutrality, burstiness, and "GPT-isms" (e.g., "delve", "tapestry").
-   **👁️ Anti-Flicker Visuals:** Smooth DOM manipulation to hide/blur AI content without jarring flashes.
-   **🎭 False Positive Learning:** Community-driven whitelist system.
-   **🔒 Privacy-First:** Analysis happens locally in your browser.

## 🛠️ Installation (Developer Mode)

1.  Download this repository as a ZIP file and unzip it.
2.  Open Chrome/Brave/Edge and go to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load Unpacked**.
5.  Select the folder you just unzipped.

## 🛡️ Privacy & Reporting

This extension includes a feature to report false positives/negatives to improve the algorithm.
**Security Note:** Reports are sent via a secure, private proxy server to protect the community infrastructure. No personal data beyond the tweet text and handle is stored.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
