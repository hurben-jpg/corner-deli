# Project Pipeline: Platforms & Services Outline

This document outlines the end-to-end platforms, cloud services, software frameworks, and hardware components integrated into the **Identity Tapestry** and **Erebor Sentient Building** ecosystems.

---

## 1. Web Hosting & Version Control

| Platform/Service | Purpose | Details |
| :--- | :--- | :--- |
| **GitHub** | Version Control & Deployment Source | Hosts the project codebase. The static site builds out of the `deploy/` directory and is pushed to `https://github.com/hurben-jpg/corner-deli.git`. |
| **Static Web Hosting** | Public Website Delivery | Serves the static assets (HTML5, Vanilla CSS3, Javascript) for the Corner Deli homepage, Identity Tapestry digital archive, and Erebor interface. |
| **Google Fonts** | Typography Sourcing | Delivers modern typefaces (*Outfit* and *Inter*) used across all web layouts to match custom branding specifications. |

---

## 2. Backend Service Pipeline (Erebor API)

| Platform/Service | Role | Details |
| :--- | :--- | :--- |
| **Render** | Cloud Hosting Service | Hosts the containerized FastAPI backend at `https://erebor-willing-west.onrender.com`. Render automatically pulls updates from the GitHub repository to trigger deployments. |
| **FastAPI & Uvicorn** | Web API & Server Framework | Lightweight Python ASGI framework handling incoming client request routers (`POST /chat`, `GET /status`). |
| **python-dotenv** | Configuration Security | Manages environment-specific variables and credentials (such as API keys) locally and securely in `.env` files. |
| **Pytest** | Automated Testing | Runs backend unit testing pipelines (`tests/test_core.py`, `tests/test_erebor.py`) to verify API handlers and brain modules. |

---

## 3. Artificial Intelligence & Vector Memory (RAG)

| Service/Library | Role | Details |
| :--- | :--- | :--- |
| **LangChain** | AI Agent Orchestration | Manages prompt construction templates, memory injection, sensor aggregation, and agent workflow execution in `core/brain.py`. |
| **OpenAI / Google Gemini** | Large Language Models (LLM) | Generates character-specific responses. Utilizes `langchain-openai` and `langchain-google-genai` integration wrappers. |
| **ChromaDB** | Semantic Memory (Vector Database) | Local vector database (`Erebor/chroma_db/`) that indexes past interactions to support Retrieval-Augmented Generation (RAG). |
| **JSON Knowledge Bases** | Static Fact Retrieval | Custom local JSON files (`west_knowledge_base.json` and `pica_knowledge_base.json`) holding structured building history facts used by the memory module. |

---

## 4. IoT Hardware & Embedded Firmware

| Component | Role | Details |
| :--- | :--- | :--- |
| **ESP32-P4 Microcontroller** | Hardware Interactive Node | High-performance MCU driving the touch screen LCD demo interface (`ESP32-P4-WIFI6-Touch-LCD-XC-Demo`). |
| **ESP-IDF** | Firmware Build Toolchain | Espressif's official IoT Development Framework, used to compile embedded code and update WiFi configs. |
| **PowerShell Scripts** | Local Build Automation | PowerShell scripts (`build_and_flash.ps1`, `flash_c6.ps1`, `monitor_demo.ps1`) automating compiling, firmware updates, and serial monitor connections. |
| **Ambient Mock Sensors** | Environmental Context | Python mock layer (`sensors/`) designed to compile ambient variables (temperature, occupancy, light) to affect Erebor's conversational mood. |

---

> [!NOTE]
> ### RAG (Retrieval-Augmented Generation) Cycle
> When a user chats with Erebor, the API sends the message to the **FastAPI brain** on **Render**. The brain fetches relevant historic logs from the **ChromaDB vector memory** and appends ambient values from the **sensor module** before sending the augmented prompt to the **LLM (OpenAI/Gemini)** for a highly contextualized response.
