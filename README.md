# 🧠 NexusAI — Enterprise AI Knowledge Platform

[![CI/CD](https://github.com/nexusai/platform/actions/workflows/ci.yml/badge.svg)](https://github.com/nexusai/platform/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)

> Production-grade Enterprise AI Knowledge Platform combining **Knowledge Graph Intelligence**, **Agentic RAG**, **Enterprise Search**, **Multi-Agent Workflows**, and **Analytics** — with a premium SaaS experience.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🤖 **Agentic RAG** | 6-agent LangGraph pipeline: Query Understanding → Knowledge Graph → Retrieval → Reranking → Verification → Response |
| 🕸️ **Knowledge Graph** | Neo4j-backed graph with automatic entity/relationship extraction, NL-to-Cypher queries |
| 🔍 **Enterprise Search** | Semantic, keyword, and hybrid search with confidence scoring and faceted filters |
| 💬 **AI Chat** | ChatGPT-like experience with streaming, markdown, citations, conversation memory |
| 📄 **Document Workspace** | Split-view PDF viewer + AI chat, click-to-cite, multi-document support |
| 📊 **Analytics Center** | Query metrics, latency, accuracy, hallucination rate, token usage, cost tracking |
| 🔐 **Enterprise Security** | JWT + OAuth (Google/GitHub), RBAC, rate limiting, audit logging |
| 🎨 **4 Themes** | Light, Dark, Midnight, Cyberpunk — instant switching |

## 🏗️ Architecture

```
Frontend (Next.js 15) → API Gateway (FastAPI) → Agent Layer (LangGraph)
                                                    ↓
                                          ┌─────────┼─────────┐
                                          │         │         │
                                       Neo4j    Vector DB  PostgreSQL
                                    (Graph)   (Embeddings)  (Data)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+, Python 3.12+, Docker & Docker Compose

### 1. Clone & Install
```bash
git clone <repo-url>
cd enterprise-ai-platform

# Frontend
cd frontend && npm install

# Backend
cd ../backend && pip install -r requirements.txt
```

### 2. Start Infrastructure
```bash
cd docker
cp .env.example .env
# Edit .env with your API keys
docker-compose up -d postgres redis neo4j chromadb
```

### 3. Run Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 4. Run Frontend
```bash
cd frontend
npm run dev
```

Visit **http://localhost:3000** 🎉

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | Register new user |
| `/api/v1/auth/login` | POST | Login with email/password |
| `/api/v1/auth/oauth/url/{provider}` | GET | Get OAuth URL |
| `/api/v1/chat/` | POST | Send chat message |
| `/api/v1/chat/stream` | POST | Stream chat response (SSE) |
| `/api/v1/search/` | POST | Enterprise search |
| `/api/v1/upload/` | POST | Upload document |
| `/api/v1/graph/query` | POST | Query knowledge graph |
| `/api/v1/graph/stats` | GET | Graph statistics |
| `/api/v1/analytics/dashboard` | GET | Analytics data |
| `/api/v1/reindex/` | POST | Reindex documents |
| `/health` | GET | Health check |

Full Swagger docs: **http://localhost:8000/docs**

## 🤖 AI Providers

| Provider | Models | Setup |
|----------|--------|-------|
| **Gemini** (default) | gemini-2.0-flash | `GEMINI_API_KEY` |
| **OpenAI** | gpt-4o | `OPENAI_API_KEY` |
| **Claude** | claude-sonnet-4 | `ANTHROPIC_API_KEY` |
| **Ollama** | llama3.1, mistral | Local: `ollama serve` |

## 🗄️ Tech Stack

**Frontend**: Next.js 15, TypeScript, Tailwind CSS, Framer Motion, Zustand, Recharts, Lucide Icons

**Backend**: FastAPI, SQLAlchemy, LangGraph, Neo4j, PostgreSQL, Redis

**AI**: Gemini, OpenAI, Claude, Ollama | Embeddings: BGE-Large, E5-Large, OpenAI

**Vector DBs**: ChromaDB, FAISS, Pinecone, Weaviate

**DevOps**: Docker, Kubernetes, GitHub Actions

## 📁 Project Structure

```
enterprise-ai-platform/
├── frontend/          # Next.js 15 App Router
│   └── src/
│       ├── app/       # Pages (chat, search, graph, analytics...)
│       ├── components/# UI components
│       └── lib/       # API client, stores, utils
├── backend/           # FastAPI Python
│   └── app/
│       ├── agents/    # LangGraph 6-agent pipeline
│       ├── api/       # Routes & middleware
│       ├── auth/      # JWT + OAuth + RBAC
│       ├── db/        # PostgreSQL + Redis
│       ├── ingestion/ # Document parsers & chunking
│       ├── knowledge_graph/ # Neo4j engine
│       ├── llm/       # Multi-provider LLM factory
│       ├── memory/    # Session + long-term memory
│       └── vectorstore/ # Multi-DB vector store
├── docker/            # Docker Compose & Dockerfiles
├── k8s/               # Kubernetes manifests
├── data/sample/       # Sample tech company data
└── docs/              # Documentation
```

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
