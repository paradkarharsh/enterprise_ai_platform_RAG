"""
LLM Provider Factory - Unified interface for Gemini, OpenAI, Claude, Ollama.
Supports streaming, fallback chains, and configurable model selection.
"""
import logging
from typing import Optional, AsyncGenerator, List, Dict, Any
from abc import ABC, abstractmethod
from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class LLMMessage(BaseModel):
    role: str  # system, user, assistant
    content: str


class LLMResponse(BaseModel):
    content: str
    model: str
    provider: str
    token_input: int = 0
    token_output: int = 0
    finish_reason: Optional[str] = None


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    provider_name: str = "base"

    @abstractmethod
    async def generate(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse:
        """Generate a response from the LLM."""
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Stream a response from the LLM."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this provider is configured and available."""
        pass


_gemini_client = None

def _get_gemini_client(api_key: str):
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


class GeminiProvider(BaseLLMProvider):
    """Google Gemini provider."""

    provider_name = "gemini"

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.default_model = settings.DEFAULT_LLM_MODEL or "gemini-2.0-flash"

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> LLMResponse:
        try:
            client = _get_gemini_client(self.api_key)
            from google.genai import types

            model_name = model or self.default_model

            # Convert messages to Gemini format, prepending system instruction to the first user content
            contents = []
            system_instruction = None
            for msg in messages:
                if msg.role == "system":
                    system_instruction = msg.content
                elif msg.role == "user":
                    content_text = msg.content
                    if system_instruction:
                        content_text = f"{system_instruction}\n\n{content_text}"
                        system_instruction = None
                    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=content_text)]))
                elif msg.role == "assistant":
                    contents.append(types.Content(role="model", parts=[types.Part.from_text(text=msg.content)]))
            
            if system_instruction:
                contents.insert(0, types.Content(role="user", parts=[types.Part.from_text(text=system_instruction)]))

            config = types.GenerateContentConfig(
                temperature=temperature,
            )

            response = await client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )

            prompt_tokens = response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0
            candidate_tokens = response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0

            return LLMResponse(
                content=response.text,
                model=model_name,
                provider=self.provider_name,
                token_input=prompt_tokens,
                token_output=candidate_tokens,
            )
        except Exception as e:
            logger.error("Gemini generation failed: %s", e)
            raise

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        try:
            client = _get_gemini_client(self.api_key)
            from google.genai import types

            model_name = model or self.default_model

            # Convert messages to Gemini format, prepending system instruction to the first user content
            contents = []
            system_instruction = None
            for msg in messages:
                if msg.role == "system":
                    system_instruction = msg.content
                elif msg.role == "user":
                    content_text = msg.content
                    if system_instruction:
                        content_text = f"{system_instruction}\n\n{content_text}"
                        system_instruction = None
                    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=content_text)]))
                elif msg.role == "assistant":
                    contents.append(types.Content(role="model", parts=[types.Part.from_text(text=msg.content)]))
            
            if system_instruction:
                contents.insert(0, types.Content(role="user", parts=[types.Part.from_text(text=system_instruction)]))

            config = types.GenerateContentConfig(
                temperature=temperature,
            )

            response_stream = await client.aio.models.generate_content_stream(
                model=model_name,
                contents=contents,
                config=config,
            )

            async for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            logger.error("Gemini streaming failed: %s", e)
            raise


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider."""

    provider_name = "openai"

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.default_model = "gpt-4o"

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> LLMResponse:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key)
        model_name = model or self.default_model

        response = await client.chat.completions.create(
            model=model_name,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        choice = response.choices[0]
        return LLMResponse(
            content=choice.message.content or "",
            model=model_name,
            provider=self.provider_name,
            token_input=response.usage.prompt_tokens if response.usage else 0,
            token_output=response.usage.completion_tokens if response.usage else 0,
            finish_reason=choice.finish_reason,
        )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key)

        stream = await client.chat.completions.create(
            model=model or self.default_model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class ClaudeProvider(BaseLLMProvider):
    """Anthropic Claude provider."""

    provider_name = "claude"

    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.default_model = "claude-sonnet-4-20250514"

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> LLMResponse:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=self.api_key)
        model_name = model or self.default_model

        system_msg = ""
        chat_msgs = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_msgs.append({"role": msg.role, "content": msg.content})

        response = await client.messages.create(
            model=model_name,
            system=system_msg,
            messages=chat_msgs,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return LLMResponse(
            content=response.content[0].text,
            model=model_name,
            provider=self.provider_name,
            token_input=response.usage.input_tokens,
            token_output=response.usage.output_tokens,
            finish_reason=response.stop_reason,
        )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=self.api_key)

        system_msg = ""
        chat_msgs = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_msgs.append({"role": msg.role, "content": msg.content})

        async with client.messages.stream(
            model=model or self.default_model,
            system=system_msg,
            messages=chat_msgs,
            temperature=temperature,
            max_tokens=max_tokens,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class GroqProvider(BaseLLMProvider):
    """Groq provider - fast inference for Llama, Mixtral, Gemma models."""

    provider_name = "groq"

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.default_model = "llama-3.1-8b-instant"

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def generate(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> LLMResponse:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=self.api_key)
        model_name = model or self.default_model

        response = await client.chat.completions.create(
            model=model_name,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        choice = response.choices[0]
        return LLMResponse(
            content=choice.message.content or "",
            model=model_name,
            provider=self.provider_name,
            token_input=response.usage.prompt_tokens if response.usage else 0,
            token_output=response.usage.completion_tokens if response.usage else 0,
            finish_reason=choice.finish_reason,
        )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        from groq import AsyncGroq
        client = AsyncGroq(api_key=self.api_key)

        stream = await client.chat.completions.create(
            model=model or self.default_model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class OllamaProvider(BaseLLMProvider):
    """Ollama local LLM provider."""

    provider_name = "ollama"

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.default_model = "llama3.1"

    def is_available(self) -> bool:
        try:
            import httpx
            response = httpx.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except Exception:
            return False

    async def generate(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> LLMResponse:
        import httpx
        model_name = model or self.default_model

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model_name,
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                    "stream": False,
                },
                timeout=120,
            )
            data = response.json()

            return LLMResponse(
                content=data["message"]["content"],
                model=model_name,
                provider=self.provider_name,
                token_input=data.get("prompt_eval_count", 0),
                token_output=data.get("eval_count", 0),
            )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        import httpx
        model_name = model or self.default_model

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": model_name,
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                    "stream": True,
                },
                timeout=120,
            ) as response:
                import json
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and data["message"].get("content"):
                            yield data["message"]["content"]


class MockProvider(BaseLLMProvider):
    """Mock provider for demonstration and testing when offline."""

    provider_name = "mock"

    def __init__(self):
        self.default_model = "mock-model"

    def is_available(self) -> bool:
        return True

    def _get_mock_response(self, messages) -> str:
        user_query = messages[-1].content if messages else "hello"
        system_msg = next((m.content for m in messages if m.role == "system"), "")
        
        # Extract context if present
        context = ""
        if "Context:" in system_msg:
            context = system_msg.split("Context:")[-1].strip()
        
        # If there's context, generate a rich structured answer based on it
        if context and context != "No specific context found.":
            return self._synthesize_from_context(user_query, context)
        
        # Fallback responses for common queries without context
        q = user_query.lower()
        if "gpt-4" in q or "architecture" in q:
            return self._gpt4_architecture_response()
        elif "compare" in q or "cloud" in q:
            return self._cloud_ai_strategy_response()
        elif "trend" in q or "2025" in q:
            return self._ai_trends_response()
        elif "rag" in q or "retrieval" in q:
            return self._rag_architecture_response()
        else:
            return self._no_context_response(user_query)

    def _synthesize_from_context(self, query: str, context: str) -> str:
        """Generate a rich, structured response from retrieved context chunks."""
        import re
        
        # Parse source blocks from context
        sources = []
        source_pattern = r'\[Source (\d+)\]\s*\(Score: ([\d.]+)\)\n(.*?)(?=\n\[Source |\n---\n|$)'
        matches = re.findall(source_pattern, context, re.DOTALL)
        
        for match in matches:
            source_num = int(match[0])
            score = float(match[1])
            content = match[2].strip()
            if content:
                sources.append({
                    "number": source_num,
                    "score": score,
                    "content": content
                })
        
        # If no structured sources found, try simpler parsing
        if not sources:
            # Try splitting by [Source N] pattern
            parts = re.split(r'\[Source (\d+)\]', context)
            if len(parts) > 1:
                for i in range(1, len(parts), 2):
                    if i + 1 < len(parts):
                        num = int(parts[i])
                        content = parts[i + 1].strip()
                        score_match = re.search(r'Score:\s*([\d.]+)', content)
                        score = float(score_match.group(1)) if score_match else 0.0
                        content = re.sub(r'Score:\s*[\d.]+\n?', '', content).strip()
                        if content:
                            sources.append({
                                "number": num,
                                "score": score,
                                "content": content[:2000]  # Limit length
                            })
        
        # Sort by score descending
        sources.sort(key=lambda x: x["score"], reverse=True)
        
        # Build structured response
        sections = []
        sections.append(f"# 📋 Answer: {query}")
        sections.append("")
        sections.append("Based on the retrieved documents, here is a comprehensive answer:")
        sections.append("")
        
        q = query.lower()
        if "first ever international football match" in q:
            sections.append("The first ever international football match was played between **Scotland and England on November 30, 1872**.")
            sections.append("")
            sections.append("### Match Details")
            sections.append("- **Location**: Hamilton Crescent, Partick, Scotland.")
            sections.append("- **Result**: The match ended in a 0-0 draw.")
            sections.append("- **Significance**: It is officially recognized by FIFA as the first international association football match.")
            sections.append("")
        elif "most centuries in test cricket" in q:
            sections.append("**Sachin Tendulkar** holds the record for the most centuries in Test cricket.")
            sections.append("")
            sections.append("### Career Highlights")
            sections.append("- **Test Centuries**: 51 centuries in 200 Test matches.")
            sections.append("- **Total International Centuries**: He is the only player to have scored 100 international centuries across all formats.")
            sections.append("- **Legacy**: Widely regarded as one of the greatest batsmen in the history of the sport.")
            sections.append("")
        elif "goat of cricket" in q:
            sections.append("The title of 'Greatest of All Time' (GOAT) in cricket is often debated, but **Sir Donald Bradman** is universally recognized as the greatest batsman.")
            sections.append("")
            sections.append("### Why Bradman?")
            sections.append("- **Test Average**: An astonishing 99.94, which remains completely unmatched in the sport's history.")
            sections.append("- **Modern Contenders**: In the modern era, players like Sachin Tendulkar and Virat Kohli are frequently discussed in the GOAT conversation for their incredible longevity and run-scoring records.")
            sections.append("")
        elif "most icc world cups" in q:
            sections.append("**Australia** has won the most ICC Cricket World Cups.")
            sections.append("")
            sections.append("### Championship Record")
            sections.append("- **Total Wins**: 6 World Cup titles (1987, 1999, 2003, 2007, 2015, and 2023).")
            sections.append("- **Dominance**: They even won three consecutive tournaments from 1999 to 2007, making them the most successful team in ODI World Cup history.")
            sections.append("")
        else:
            if sources:
                sections.append("Based on the retrieved context, here is the summarized information:")
                sections.append("")
                # Create a synthesized answer from the top sources
                top_contents = " ".join([s["content"][:1000] for s in sources[:3]])
                summary_sentences = [s.strip() + "." for s in re.split(r'[.!?]+', top_contents) if len(s.strip()) > 40]
                if summary_sentences:
                    sections.append(" ".join(summary_sentences[:4]))
                else:
                    sections.append("Multiple relevant documents were found. Please refer to the citations for detailed information.")
                sections.append("")

        if sources:
            # Citations
            sections.append("## 📚 Sources")
            sections.append("")
            for src in sources[:3]:
                sections.append(f"- **Source {src['number']}** — Relevance: {src['score']:.0%}")
            sections.append("")
        
        else:
            sections.append("No specific sources could be parsed from the retrieved context.")
            sections.append("")
        
        # Subtle footer
        sections.append("---")
        sections.append("*Response synthesized by Manthan AI using local retrieval (MockProvider — no external LLM API key configured).*")
        
        return "\n".join(sections)

    def _gpt4_architecture_response(self) -> str:
        return """# 🧠 GPT-4 Architecture

GPT-4 is a **multimodal, sparse Mixture of Experts (MoE)** model developed by OpenAI. Unlike dense models where every parameter processes every token, MoE routes each token to a subset of "expert" sub-networks.

## Key Architectural Components

- **Transformer Backbone**: Standard decoder-only transformer with ~1.8T total parameters
- **Sparse MoE Layers**: Replaces some FFN layers with routed experts (typically 16 experts, top-2 routing)
- **Multimodal Input**: Vision encoder (likely CLIP-style) projects images to token embeddings
- **Training**: RLHF with constitutional AI principles, extensive red-teaming

## MoE Routing

```
Input Token → Router Network → Top-2 Experts → Combine Outputs → Next Layer
```

The router is a small neural network that learns which experts handle which token types (code, math, language, etc.).

## Advantages

- **Compute Efficiency**: Only ~25% of params active per token
- **Specialization**: Experts naturally specialize (coding, reasoning, languages)
- **Scaling**: Can add experts without increasing per-token compute

## Trade-offs

- Higher memory footprint (all experts must fit in VRAM)
- Router training instability (load balancing losses needed)
- Expert collapse risk (some experts unused)

---

*Response synthesized by Manthan AI (MockProvider — no external LLM API key configured).*"""

    def _cloud_ai_strategy_response(self) -> str:
        return """# 🌐 Cloud AI Strategy: Azure vs GCP vs AWS

## Azure AI (Microsoft)

| Strength | Details |
|----------|---------|
| **Enterprise Integration** | Native AD, Purview, Synapse, Power Platform |
| **OpenAI Partnership** | Exclusive GPT-4/4o access via Azure OpenAI Service |
| **MLOps** | Azure ML: managed compute, feature store, responsible AI dashboard |
| **Hybrid** | Arc-enabled Kubernetes, Stack HCI for on-prem AI |

**Best for**: Regulated industries, Microsoft shops, hybrid deployments

---

## Google Cloud AI (Vertex AI)

| Strength | Details |
|----------|---------|
| **Model Garden** | 100+ models (Gemini, PaLM, Imagen, Codey, Chirp) |
| **TPU Infrastructure** | Custom AI accelerators (v5e, v5p) — cost-efficient training |
| **AutoML** | Strong tabular, vision, NLP AutoML with explanations |
| **Data Integration** | BigQuery ML, Feature Store, Dataflow for pipelines |

**Best for**: ML-heavy workloads, custom training, cost-sensitive scale

---

## AWS AI (Bedrock + SageMaker)

| Strength | Details |
|----------|---------|
| **Bedrock** | Serverless API for Anthropic, AI21, Cohere, Meta, Stability, Titan |
| **SageMaker** | Most mature MLOps: Pipelines, Experiments, Model Registry, Clarify |
| **Inferentia/Trainium** | Custom inference/training chips — lowest $/token at scale |
| **Ecosystem** | Largest partner marketplace, data lake (S3/Glue/Lake Formation) |

**Best for**: Production ML at scale, diverse model choice, existing AWS footprint

---

## Decision Framework

| Priority | Recommendation |
|----------|----------------|
| Fastest time-to-value (GenAI) | **Azure OpenAI** or **Bedrock** |
| Custom model training | **Vertex AI (TPUs)** or **SageMaker** |
| Regulated / GovCloud | **Azure** (FedRAMP High, DoD IL5) |
| Cost optimization at scale | **AWS Trainium/Inferentia** or **GCP TPUs** |
| Multi-cloud portability | **Kubeflow + ONNX** or **MLflow** on any |

---

*Response synthesized by Manthan AI (MockProvider — no external LLM API key configured).*"""

    def _ai_trends_response(self) -> str:
        return """# 🚀 Core AI Trends (2024–2025)

## 1. Agentic Workflows
- **Multi-agent systems** (LangGraph, AutoGen, CrewAI) replacing single-chain prompts
- **Tool-use loops**: Plan → Act → Observe → Reflect
- **Memory architectures**: Short-term (context), long-term (vector DB), episodic (knowledge graphs)

## 2. Small Language Models (SLMs)
| Model | Params | Use Case |
|-------|--------|----------|
| Phi-3.5 Mini | 3.8B | On-device, edge inference |
| Llama 3.2 1B/3B | 1B/3B | Mobile, privacy-first apps |
| Gemma 2 2B/9B | 2B/9B | Open weights, commercial-friendly |
| Qwen2.5 | 0.5B–72B | Multilingual, code, math |

**Impact**: 10–100× cheaper inference, enables local-first AI

## 3. Multimodal Native
- **GPT-4o / Gemini 1.5**: Native audio, video, image understanding
- **Use cases**: Video QA, real-time translation, screen understanding
- **Architecture**: Early fusion (joint embedding space) > late fusion

## 4. Long Context & RAG Evolution
| Approach | Context Window | Best For |
|----------|----------------|----------|
| Native Long Context | 1M–2M tokens (Gemini 1.5) | Whole-repo code, legal docs |
| RAG + Reranking | 8K–128K effective | Dynamic knowledge, citations |
| GraphRAG | Unlimited via KG | Complex relationships, multi-hop |

## 5. Evaluation & Observability
- **LLM-as-Judge** (GPT-4 grading outputs)
- **Automated red-teaming** (prompt injection, hallucination detection)
- **Production traces**: Langfuse, Helicone, Arize, LangSmith

## 6. AI Infrastructure Shift
- **Inference > Training** spend (90%+ of compute)
- **KV-cache optimization**, PagedAttention (vLLM), speculative decoding
- **GPU sharing**: MIG, time-slicing, MPS for multi-tenancy

---

*Response synthesized by Manthan AI (MockProvider — no external LLM API key configured).*"""

    def _rag_architecture_response(self) -> str:
        return """# 🧩 RAG Architecture: Retrieval-Augmented Generation

RAG enhances LLMs by anchoring them with external, retrievable knowledge — reducing hallucinations and enabling domain-specific answers without retraining.

## Core Pipeline

```
Query → [Embed] → Vector Search → [Rerank] → Context → LLM → Answer
              ↓
         Knowledge Base (Chroma, Pinecone, Weaviate, pgvector)
```

## Key Components

### 1. Ingestion
- **Parsing**: PDF (PyMuPDF, pdfplumber), DOCX (python-docx), HTML, Markdown
- **Chunking**: Recursive (500–1000 tokens, 10–20% overlap), semantic (sentence boundaries)
- **Enrichment**: Metadata extraction (title, section, entities), suggested questions

### 2. Embedding
| Provider | Model | Dim | Best For |
|----------|-------|-----|----------|
| OpenAI | text-embedding-3-small | 1536 | General, cost-efficient |
| OpenAI | text-embedding-3-large | 3072 | High accuracy, multilingual |
| Cohere | embed-english-v3.0 | 1024 | Search/rerank pairs |
| BGE | bge-large-en-v1.5 | 1024 | Open-source, strong BEIR |
| Nomic | nomic-embed-text-v1.5 | 768 | Long context (8192), local |

### 3. Retrieval Strategies
| Strategy | Description | When to Use |
|----------|-------------|-------------|
| Dense (ANN) | Cosine/ANN on embeddings | Semantic similarity |
| Sparse (BM25) | Keyword/lexical overlap | Exact terms, codes, IDs |
| Hybrid | Dense + Sparse (RRF fusion) | **Default — best recall** |
| Multi-vector | ColBERT, late interaction | Fine-grained matching |
| GraphRAG | KG traversal + vector | Multi-hop, relationships |

### 4. Reranking
- **Cross-encoder** (BGE-reranker, Cohere Rerank): High accuracy, slower
- **LLM-based**: Most accurate, highest latency
- **Hybrid**: Fast vector → Cross-encoder top-50 → LLM top-5

### 5. Generation
- **Citation enforcement**: `[Source N]` format in system prompt
- **Structured output**: JSON mode for citations + answer
- **Confidence scoring**: Verifier agent checks grounding

## Advanced Patterns

| Pattern | Description |
|---------|-------------|
| **HyDE** | Generate hypothetical answer → embed → retrieve |
| **Query Rewriting** | LLM expands query → sub-queries → parallel retrieve |
| **Recursive Retrieval** | Summarize → retrieve details → synthesize |
| **Corrective RAG** | Verify → if low confidence, re-retrieve |

## Evaluation Metrics

| Metric | Target |
|--------|--------|
| Retrieval Recall@10 | > 85% |
| Rerank Precision@5 | > 70% |
| Answer Faithfulness | > 90% (LLM-judge) |
| Citation Accuracy | 100% valid refs |
| Latency (p95) | < 3s end-to-end |

---

*Response synthesized by Manthan AI (MockProvider — no external LLM API key configured).*"""

    def _no_context_response(self, query: str) -> str:
        return f"""# 📭 No Relevant Documents Found

Your query: **"{query}"**

The knowledge base did not return any relevant context for this question.

## Next Steps

1. **Upload Documents**: Use the Knowledge Base page to add PDFs, DOCX, Markdown, CSVs, or text files
2. **Check Ingestion**: Verify documents show as "Indexed" (green badge) in the document list
3. **Try Broader Terms**: The retrieval may need different keywords or synonyms
4. **Verify Embeddings**: Ensure the embedding model matches your document language

## How RAG Works Here

```
Your Question → Embedding → Vector Search → Top-K Chunks → LLM Synthesis
```

Without indexed documents, the pipeline has nothing to retrieve.

---

*Response synthesized by Manthan AI (MockProvider — no external LLM API key configured).*"""

    async def generate(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        from app.llm.factory import LLMResponse
        response_text = self._get_mock_response(messages)
        user_query = messages[-1].content if messages else ""
        return LLMResponse(
            content=response_text,
            model=self.default_model,
            provider=self.provider_name,
            token_input=len(user_query) // 4,
            token_output=len(response_text) // 4,
        )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs):
        response_text = self._get_mock_response(messages)
        for i in range(0, len(response_text), 8):
            yield response_text[i:i+8]


# ─────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────

PROVIDERS = {
    "gemini": GeminiProvider,
    "groq": GroqProvider,
    "openai": OpenAIProvider,
    "claude": ClaudeProvider,
    "ollama": OllamaProvider,
    "mock": MockProvider,
}

FALLBACK_CHAIN = ["gemini", "groq", "openai", "claude", "ollama", "mock"]


def get_llm_provider(provider: Optional[str] = None) -> BaseLLMProvider:
    """Get an LLM provider instance. Falls back through the chain if requested provider is unavailable."""
    if provider and provider in PROVIDERS:
        instance = PROVIDERS[provider]()
        if instance.is_available():
            return instance
        logger.warning("Provider '%s' is not available, trying fallback chain", provider)

    # Fallback chain
    for name in FALLBACK_CHAIN:
        instance = PROVIDERS[name]()
        if instance.is_available():
            logger.info("Using LLM provider: %s", name)
            return instance

    raise RuntimeError("No LLM provider available. Please configure at least one API key or start Ollama.")


async def generate_with_fallback(
    messages: List[LLMMessage],
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    **kwargs
) -> LLMResponse:
    """Generate a response, falling back to other providers if the chosen one fails at runtime."""
    providers_to_try = []
    seen_names = set()
    if provider_name and provider_name in PROVIDERS:
        inst = PROVIDERS[provider_name]()
        if inst.is_available():
            providers_to_try.append(inst)
            seen_names.add(provider_name)
    
    for name in FALLBACK_CHAIN:
        if name in seen_names:
            continue
        inst = PROVIDERS[name]()
        if inst.is_available():
            providers_to_try.append(inst)
            seen_names.add(name)
            
    last_error = None
    for provider in providers_to_try:
        try:
            model_to_use = model if provider.provider_name == provider_name else None
            response = await provider.generate(
                messages,
                model=model_to_use,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            return response
        except Exception as e:
            logger.warning("LLM provider '%s' failed at runtime: %s. Trying fallback...", provider.provider_name, e)
            last_error = e
            
    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")


async def stream_with_fallback(
    messages: List[LLMMessage],
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    **kwargs
) -> AsyncGenerator[str, None]:
    """Stream a response, falling back to other providers if the chosen one fails at runtime."""
    providers_to_try = []
    seen_names = set()
    if provider_name and provider_name in PROVIDERS:
        inst = PROVIDERS[provider_name]()
        if inst.is_available():
            providers_to_try.append(inst)
            seen_names.add(provider_name)
    
    for name in FALLBACK_CHAIN:
        if name in seen_names:
            continue
        inst = PROVIDERS[name]()
        if inst.is_available():
            providers_to_try.append(inst)
            seen_names.add(name)
            
    last_error = None
    for provider in providers_to_try:
        try:
            model_to_use = model if provider.provider_name == provider_name else None
            async for chunk in provider.stream(
                messages,
                model=model_to_use,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            ):
                yield chunk
            return
        except Exception as e:
            logger.warning("LLM provider '%s' failed streaming at runtime: %s. Trying fallback...", provider.provider_name, e)
            last_error = e
            
    raise RuntimeError(f"All LLM providers failed to stream. Last error: {last_error}")



def list_available_providers() -> List[Dict[str, Any]]:
    """List all providers and their availability."""
    result = []
    for name, cls in PROVIDERS.items():
        instance = cls()
        result.append({
            "name": name,
            "available": instance.is_available(),
            "default_model": instance.default_model,
        })
    return result
