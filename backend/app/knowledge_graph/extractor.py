"""
Entity and relationship extraction from text using LLM.
"""
import logging
import json
from typing import List, Tuple
from app.llm.factory import get_llm_provider, LLMMessage
from app.knowledge_graph.engine import Entity, Relationship

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an expert entity and relationship extractor. Extract all entities and relationships from the given text.

Return a JSON object with two arrays:
{{
  "entities": [
    {{"name": "Entity Name", "type": "Person|Organization|Location|Event|Technology|Product|Concept", "properties": {{}}}}
  ],
  "relationships": [
    {{"source": "Entity1", "source_type": "Type1", "target": "Entity2", "target_type": "Type2", "relationship": "RELATIONSHIP_TYPE", "properties": {{}}}}
  ]
}}

Entity types: Person, Organization, Location, Event, Technology, Product, Concept
Relationship examples: WORKS_AT, FOUNDED, LOCATED_IN, ACQUIRED, DEVELOPED, PART_OF, INVESTED_IN, COMPETES_WITH, PARTNERS_WITH

Rules:
1. Extract ALL entities mentioned
2. Identify ALL relationships between entities
3. Use consistent naming (capitalize proper nouns)
4. Relationship types should be UPPER_CASE_WITH_UNDERSCORES
5. Include dates, amounts, and other properties when available
6. Return ONLY valid JSON"""


async def extract_entities_and_relationships(
    text: str,
    llm_provider=None,
) -> Tuple[List[Entity], List[Relationship]]:
    """Extract entities and relationships from text using LLM."""
    provider = llm_provider or get_llm_provider()

    messages = [
        LLMMessage(role="system", content=EXTRACTION_PROMPT),
        LLMMessage(role="user", content=f"Extract entities and relationships from this text:\n\n{text}"),
    ]

    try:
        response = await provider.generate(messages, temperature=0.1, max_tokens=4096)
        content = response.content.strip()

        # Clean markdown if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        data = json.loads(content)

        entities = [Entity(**e) for e in data.get("entities", [])]
        relationships = [Relationship(**r) for r in data.get("relationships", [])]

        logger.info("Extracted %d entities and %d relationships", len(entities), len(relationships))
        return entities, relationships

    except (json.JSONDecodeError, Exception) as e:
        logger.error("Entity extraction failed: %s", e)
        return [], []
