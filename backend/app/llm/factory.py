"""
LLM Provider Factory - Unified interface for Gemini, OpenAI, Claude, Ollama.
Supports streaming, fallback chains, and configurable model selection.
"""
import logging
from typing import Optional, AsyncGenerator, List, Dict, Any, cast
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
        yield ""  # pragma: no cover

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this provider is configured and available."""
        pass


_gemini_clients: Dict[str, Any] = {}

def _get_gemini_client(api_key: Optional[str] = None):
    if not api_key:
        api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("Gemini API key is required.")
    if api_key not in _gemini_clients:
        from google import genai
        _gemini_clients[api_key] = genai.Client(api_key=api_key)
    return _gemini_clients[api_key]


class GeminiProvider(BaseLLMProvider):
    """Google Gemini provider."""

    provider_name = "gemini"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.default_model = settings.DEFAULT_LLM_MODEL or "gemini-2.0-flash"

    def is_available(self) -> bool:
        return bool(self.api_key) and not self.api_key.startswith("your_") and not self.api_key.startswith("change-")

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

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.default_model = "gpt-4o"

    def is_available(self) -> bool:
        return bool(self.api_key) and not self.api_key.startswith("your_") and not self.api_key.startswith("change-")

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

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.default_model = "claude-sonnet-4-20250514"

    def is_available(self) -> bool:
        return bool(self.api_key) and not self.api_key.startswith("your_") and not self.api_key.startswith("change-")

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

        create_kwargs: Dict[str, Any] = {
            "model": model_name,
            "messages": chat_msgs,
            "max_tokens": max_tokens,
        }
        if system_msg:
            create_kwargs["system"] = system_msg
        if temperature is not None:
            create_kwargs["temperature"] = temperature

        response: Any = await client.messages.create(**create_kwargs)

        return LLMResponse(
            content=response.content[0].text,
            model=model_name,
            provider=self.provider_name,
            token_input=response.usage.input_tokens,
            token_output=response.usage.output_tokens,
            finish_reason=response.stop_reason,
        )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> AsyncGenerator[str, None]:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=self.api_key)

        system_msg = ""
        chat_msgs: List[Dict[str, Any]] = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_msgs.append({"role": msg.role, "content": msg.content})

        stream_kwargs: Dict[str, Any] = {
            "model": model or self.default_model,
            "messages": chat_msgs,
            "max_tokens": max_tokens,
        }
        if system_msg:
            stream_kwargs["system"] = system_msg
        if temperature is not None:
            stream_kwargs["temperature"] = temperature

        async with client.messages.stream(**stream_kwargs) as stream:
            async for text in stream.text_stream:
                yield text


class GroqProvider(BaseLLMProvider):
    """Groq provider - fast inference for Llama, Mixtral, Gemma models."""

    provider_name = "groq"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.default_model = "groq/compound"

    def is_available(self) -> bool:
        return bool(self.api_key) and not self.api_key.startswith("your_") and not self.api_key.startswith("change-")

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

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> AsyncGenerator[str, None]:
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

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> AsyncGenerator[str, None]:
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
        
        # 1. Verification agent JSON request
        if "confidence_score" in system_msg and "relevance_scores" in system_msg:
            return self._mock_verification_response(user_query)

        # 2. Intent detection JSON request
        if "Analyze the user query and return a JSON object" in system_msg or '"intents"' in system_msg:
            return self._mock_intent_response(user_query)

        # 3. Specialized agents coordinator JSON request
        if "Select relevant specialized agents" in system_msg:
            return '["knowledge_graph", "rag_retriever"]'

        # Extract context if present
        context = ""
        if "Context:" in system_msg:
            context = system_msg.split("Context:")[-1].strip()
        
        # If there's context, generate an accurate extractive answer based on query relevance
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

    def _mock_verification_response(self, prompt: str) -> str:
        import json
        import re
        query = ""
        context = ""
        if "Query:" in prompt:
            parts = prompt.split("Retrieved Context:")
            query = parts[0].replace("Query:", "").strip()
            context = parts[1].strip() if len(parts) > 1 else ""
        
        STOPWORDS = {"who", "what", "where", "when", "why", "how", "is", "are", "was", "were", "the", "a", "an", "in", "on", "of", "for", "to", "with", "at", "from", "by", "about"}
        terms = [t for t in re.sub(r'[^\w\s]', '', query.lower()).split() if t and t not in STOPWORDS]
        
        chunks = [c.strip() for c in context.split("\n---\n") if c.strip()]
        relevance_scores = []
        for c in chunks:
            c_lower = c.lower()
            if terms:
                overlap = sum(1 for t in terms if t in c_lower)
                score = round(min(0.95, max(0.2, 0.4 + 0.55 * (overlap / len(terms)))), 2)
            else:
                score = 0.5
            relevance_scores.append(score)
        
        confidence = max(relevance_scores) if relevance_scores else 0.5
        return json.dumps({
            "confidence_score": confidence,
            "relevance_scores": relevance_scores,
            "sufficient_context": confidence >= 0.5,
            "potential_gaps": [] if confidence >= 0.5 else ["Detailed information missing in retrieved documents"]
        })

    def _mock_intent_response(self, query: str) -> str:
        import json
        q_lower = query.lower()
        if any(w in q_lower for w in ["error", "bug", "crash", "install", "fail", "code"]):
            intent = "technical"
            domain = "it"
        elif any(w in q_lower for w in ["price", "cost", "plan", "subscription", "feature", "product"]):
            intent = "product"
            domain = "sales"
        elif any(w in q_lower for w in ["bill", "invoice", "refund", "charge"]):
            intent = "billing"
            domain = "finance"
        elif any(w in q_lower for w in ["who", "what", "where", "when", "how", "why"]):
            intent = "faq"
            domain = "general"
        else:
            intent = "general"
            domain = "general"
            
        return json.dumps({
            "intents": [intent],
            "domain": domain,
            "sentiment": "neutral",
            "urgency": "low",
            "language": "en",
            "rewritten_query": query,
            "sub_queries": [],
            "metadata_filters": {}
        })

    def _synthesize_from_context(self, query: str, context: str) -> str:
        """Extractively and accurately synthesize an answer based on query relevance from retrieved context."""
        import re

        # Parse source blocks from context
        sources = []
        source_pattern = r'\[Source\s+(\d+)\]\s*([^\n(]*?)(?:\(Score:\s*([\d.]+)\))?\n(.*?)(?=\n\[Source|\n---\n|\Z)'
        matches = re.findall(source_pattern, context, re.DOTALL)
        
        for m in matches:
            s_num = int(m[0])
            s_title = m[1].strip() or f"Source {s_num}"
            try:
                s_score = float(m[2]) if m[2] else 0.5
            except ValueError:
                s_score = 0.5
            s_content = m[3].strip()
            if s_content:
                sources.append({
                    "number": s_num,
                    "title": s_title,
                    "score": s_score,
                    "content": s_content
                })

        # Fallback simpler source regex if needed
        if not sources:
            pattern = r'\[Source\s*(\d+)\]\s*(.*?)(?=\n\[Source|\Z)'
            for m in re.finditer(pattern, context, re.DOTALL):
                raw = m.group(2).strip()
                score_match = re.search(r'Score:\s*([\d.]+)', raw)
                score = float(score_match.group(1)) if score_match else 0.5
                clean_content = re.sub(r'\(Score:\s*[\d.]+\)', '', raw).strip()
                sources.append({
                    "number": int(m.group(1)),
                    "title": f"Source {m.group(1)}",
                    "score": score,
                    "content": clean_content
                })

        # Tokenize query for keyword extraction (ignore common stopwords)
        STOPWORDS = {
            "who", "what", "where", "when", "why", "how", "is", "are", "was", "were",
            "the", "a", "an", "in", "on", "of", "for", "to", "with", "at", "from", "by",
            "about", "tell", "me", "give", "please", "can", "you", "does", "do", "did",
            "and", "or", "any", "some", "my", "your", "their", "its", "this", "that"
        }
        clean_q = re.sub(r'[^\w\s]', '', query.lower())
        query_terms = [t for t in clean_q.split() if t and t not in STOPWORDS]
        query_phrase = clean_q.strip()

        # Break content into sections/paragraphs across all sources
        best_sections: List[Dict[str, Any]] = []
        for src in sources:
            content = str(src.get("content") or "")
            # Split by markdown headers or double newlines
            paragraphs = re.split(r'\n(?=#{1,4}\s)|\n\n+', content)
            for p in paragraphs:
                p_clean = p.strip()
                if not p_clean or len(p_clean) < 20:
                    continue
                p_lower = p_clean.lower()
                
                # Calculate relevance score for this paragraph/section
                score = 0.0
                matched_terms = [t for t in query_terms if t in p_lower]
                
                # Check for full query phrase
                if query_phrase and len(query_phrase) > 3 and query_phrase in p_lower:
                    score += 10.0
                
                # Check if heading contains query terms
                first_line = p_clean.split("\n")[0].lower()
                if first_line.startswith("#"):
                    heading_matches = [t for t in query_terms if t in first_line]
                    if heading_matches:
                        score += 5.0 * len(heading_matches)
                
                # Term overlap
                if query_terms:
                    overlap_ratio = len(matched_terms) / len(query_terms)
                    score += overlap_ratio * 4.0
                
                if score > 0.5:
                    best_sections.append({
                        "source_num": src["number"],
                        "source_title": src.get("title", f"Source {src['number']}"),
                        "score": score,
                        "content": p_clean,
                        "matched_terms": matched_terms
                    })

        # Sort sections by match score
        best_sections.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)

        sections = []
        sections.append(f"# 📋 Answer: {query}")
        sections.append("")

        if best_sections:
            sections.append("Based on the retrieved documents, here is the verified information:")
            sections.append("")
            seen_texts = set()
            for sec in best_sections[:3]:
                sec_text = str(sec.get("content") or "")
                snippet = sec_text[:100].lower()
                if snippet in seen_texts:
                    continue
                seen_texts.add(snippet)
                sections.append(sec_text)
                sections.append("")
        else:
            sections.append(f"The retrieved knowledge base documents do not contain specific information about **{query}**.")
            sections.append("")
            if sources:
                sample_headings = []
                for s in sources[:3]:
                    s_text = str(s.get("content") or "")
                    hdrs = [line.strip("# ").strip() for line in s_text.split("\n") if line.strip().startswith("#")][:2]
                    sample_headings.extend(hdrs)
                if sample_headings:
                    sections.append(f"*The available documents in this context cover: {', '.join(sample_headings[:5])}.*")
                    sections.append("")
                sections.append("Please upload documentation relevant to your query or rephrase with available topics.")
                sections.append("")

        # Citations
        if sources:
            sections.append("## 📚 Sources")
            sections.append("")
            for src in sources[:4]:
                s_title = src.get("title") or f"Source {src['number']}"
                sections.append(f"- **Source {src['number']} ({s_title})** — Relevance: {src['score']:.0%}")
            sections.append("")

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
        response_text = self._get_mock_response(messages)
        user_query = messages[-1].content if messages else ""
        return LLMResponse(
            content=response_text,
            model=self.default_model,
            provider=self.provider_name,
            token_input=len(user_query) // 4,
            token_output=len(response_text) // 4,
        )

    async def stream(self, messages, model=None, temperature=0.7, max_tokens=4096, **kwargs) -> AsyncGenerator[str, None]:
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


def get_provider_instance(
    name: str,
    api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None
) -> Optional[BaseLLMProvider]:
    """Instantiate a provider with user-provided API key if available."""
    if name not in PROVIDERS:
        return None
    cls = PROVIDERS[name]
    key = None
    if user_api_keys and isinstance(user_api_keys, dict):
        key = user_api_keys.get(name)
    if not key and api_key:
        key = api_key
    if key and name in ("gemini", "groq", "openai", "claude"):
        return cast(Any, cls)(api_key=key)
    return cls()


def get_llm_provider(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None
) -> BaseLLMProvider:
    """Get an LLM provider instance with optional user API key. Falls back through the chain."""
    if provider and provider in PROVIDERS:
        instance = get_provider_instance(provider, api_key=api_key, user_api_keys=user_api_keys)
        if instance and instance.is_available():
            return instance
        logger.warning("Provider '%s' is not available, trying fallback chain", provider)

    # Fallback chain
    for name in FALLBACK_CHAIN:
        instance = get_provider_instance(name, api_key=api_key, user_api_keys=user_api_keys)
        if instance and instance.is_available():
            logger.info("Using LLM provider: %s", name)
            return instance

    raise RuntimeError("No LLM provider available. Please configure an API key or start Ollama.")


async def generate_with_fallback(
    messages: List[LLMMessage],
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
    **kwargs
) -> LLMResponse:
    """Generate a response using user-provided API keys, falling back to other providers if needed."""
    providers_to_try = []
    seen_names = set()
    if provider_name and provider_name in PROVIDERS:
        inst = get_provider_instance(provider_name, api_key=api_key, user_api_keys=user_api_keys)
        if inst and inst.is_available():
            providers_to_try.append(inst)
            seen_names.add(provider_name)
    
    for name in FALLBACK_CHAIN:
        if name in seen_names:
            continue
        inst = get_provider_instance(name, api_key=api_key, user_api_keys=user_api_keys)
        if inst and inst.is_available():
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
    api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
    **kwargs
) -> AsyncGenerator[str, None]:
    """Stream a response using user-provided API keys, falling back to other providers if needed."""
    providers_to_try = []
    seen_names = set()
    if provider_name and provider_name in PROVIDERS:
        inst = get_provider_instance(provider_name, api_key=api_key, user_api_keys=user_api_keys)
        if inst and inst.is_available():
            providers_to_try.append(inst)
            seen_names.add(provider_name)
    
    for name in FALLBACK_CHAIN:
        if name in seen_names:
            continue
        inst = get_provider_instance(name, api_key=api_key, user_api_keys=user_api_keys)
        if inst and inst.is_available():
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


async def validate_api_key(provider: str, api_key: str) -> bool:
    """Test and validate that an API key is functional with the remote provider."""
    if not api_key or not api_key.strip():
        raise ValueError("API key cannot be empty.")
    
    prov = provider.lower().strip()
    key = api_key.strip()
    
    if prov == "gemini":
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=key)
        model_name = getattr(settings, "DEFAULT_LLM_MODEL", "gemini-2.0-flash") or "gemini-2.0-flash"
        try:
            resp = await client.aio.models.generate_content(
                model=model_name,
                contents="ping",
                config=types.GenerateContentConfig(max_output_tokens=5),
            )
            return bool(resp and hasattr(resp, "text"))
        except Exception as ex:
            # If specific model name is deprecated or unavailable, verify key via models.list()
            try:
                models_iter = client.models.list()
                return True
            except Exception:
                raise ex
    elif prov == "groq":
        from groq import AsyncGroq
        client = AsyncGroq(api_key=key)
        resp = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return bool(resp.choices)
    elif prov == "openai":
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=key)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return bool(resp.choices)
    elif prov == "claude":
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=key)
        resp = await client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=5,
            messages=[{"role": "user", "content": "ping"}],
        )
        return bool(resp.content)
    else:
        raise ValueError(f"Unknown or unsupported provider: {provider}")


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
