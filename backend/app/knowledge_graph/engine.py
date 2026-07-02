"""
Knowledge Graph Engine - Neo4j operations, entity extraction, and Cypher generation.
"""
import logging
import json
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class Entity(BaseModel):
    """Extracted entity."""
    name: str
    type: str  # Person, Organization, Location, Event, Technology, Product, Concept
    properties: Dict[str, Any] = {}


class Relationship(BaseModel):
    """Extracted relationship."""
    source: str
    source_type: str
    target: str
    target_type: str
    relationship: str
    properties: Dict[str, Any] = {}


class GraphResult(BaseModel):
    """Result from a graph query."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    raw_data: List[Dict[str, Any]] = []


class KnowledgeGraphEngine:
    """Neo4j-backed knowledge graph operations."""

    def __init__(self):
        self._driver = None
        self._connection_failed = False

    def _get_driver(self):
        if self._connection_failed:
            return None
        if self._driver is None:
            try:
                from neo4j import GraphDatabase
                self._driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                    connection_timeout=2.0,
                )
                self._driver.verify_connectivity()
                logger.info("✅ Neo4j connected at %s", settings.NEO4J_URI)
            except Exception as e:
                logger.warning("⚠️ Neo4j connection failed: %s. Disabling Neo4j integration.", e)
                self._driver = None
                self._connection_failed = True
        return self._driver

    async def execute_cypher(self, query: str, params: Optional[dict] = None) -> List[Dict]:
        """Execute a Cypher query and return results."""
        driver = self._get_driver()
        if not driver:
            return []

        with driver.session() as session:
            result = session.run(query, params or {})
            return [record.data() for record in result]

    async def add_entity(self, entity: Entity) -> str:
        """Add an entity node to the graph."""
        props = {**entity.properties, "name": entity.name}
        props_str = ", ".join(f"{k}: ${k}" for k in props)
        query = f"MERGE (n:{entity.type} {{{props_str}}}) RETURN elementId(n) as id"
        result = await self.execute_cypher(query, props)
        return result[0]["id"] if result else ""

    async def add_relationship(self, rel: Relationship) -> bool:
        """Add a relationship between two entities."""
        query = f"""
        MERGE (a:{rel.source_type} {{name: $source_name}})
        MERGE (b:{rel.target_type} {{name: $target_name}})
        MERGE (a)-[r:{rel.relationship.upper().replace(' ', '_')}]->(b)
        SET r += $properties
        RETURN type(r) as rel_type
        """
        params = {
            "source_name": rel.source,
            "target_name": rel.target,
            "properties": rel.properties,
        }
        result = await self.execute_cypher(query, params)
        return bool(result)

    async def search_entities(self, query: str, entity_type: Optional[str] = None, limit: int = 20) -> List[Dict]:
        """Search entities by name (fuzzy match)."""
        type_filter = f":{entity_type}" if entity_type else ""
        cypher = f"""
        MATCH (n{type_filter})
        WHERE toLower(n.name) CONTAINS toLower($query)
        RETURN n, labels(n) as labels
        LIMIT $limit
        """
        return await self.execute_cypher(cypher, {"query": query, "limit": limit})

    async def get_entity_relationships(self, entity_name: str, depth: int = 2) -> GraphResult:
        """Get an entity and its relationships up to a given depth."""
        cypher = f"""
        MATCH path = (n {{name: $name}})-[*1..{depth}]-(m)
        WITH nodes(path) as ns, relationships(path) as rs
        UNWIND ns as node
        WITH COLLECT(DISTINCT {{
            id: elementId(node),
            label: labels(node)[0],
            name: node.name,
            properties: properties(node)
        }}) as nodes, rs
        UNWIND rs as rel
        RETURN nodes,
        COLLECT(DISTINCT {{
            source: elementId(startNode(rel)),
            target: elementId(endNode(rel)),
            type: type(rel),
            properties: properties(rel)
        }}) as edges
        """
        result = await self.execute_cypher(cypher, {"name": entity_name})
        if result:
            return GraphResult(
                nodes=result[0].get("nodes", []),
                edges=result[0].get("edges", []),
                raw_data=result,
            )
        return GraphResult()

    async def get_graph_stats(self) -> Dict[str, int]:
        """Get graph statistics."""
        node_count = await self.execute_cypher("MATCH (n) RETURN count(n) as count")
        rel_count = await self.execute_cypher("MATCH ()-[r]->() RETURN count(r) as count")
        label_count = await self.execute_cypher("CALL db.labels() YIELD label RETURN count(label) as count")

        return {
            "total_nodes": node_count[0]["count"] if node_count else 0,
            "total_relationships": rel_count[0]["count"] if rel_count else 0,
            "total_labels": label_count[0]["count"] if label_count else 0,
        }

    async def natural_language_to_cypher(self, question: str, llm_provider=None) -> str:
        """Convert natural language question to Cypher query using LLM."""
        from app.llm.factory import get_llm_provider, LLMMessage

        provider = llm_provider or get_llm_provider()

        # Get schema info for context
        schema_info = await self._get_schema_info()

        messages = [
            LLMMessage(role="system", content=f"""You are a Neo4j Cypher query expert. Convert the user's natural language question into a valid Cypher query.

Graph Schema:
{schema_info}

Rules:
1. Return ONLY the Cypher query, no explanations
2. Use MATCH, WHERE, RETURN clauses appropriately
3. Use relationship types in UPPER_CASE_WITH_UNDERSCORES
4. Always LIMIT results to 50 unless specified
5. Use toLower() for case-insensitive matching
"""),
            LLMMessage(role="user", content=question),
        ]

        response = await provider.generate(messages, temperature=0.1)
        cypher = response.content.strip()
        # Clean markdown code blocks if present
        if cypher.startswith("```"):
            cypher = cypher.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return cypher

    async def _get_schema_info(self) -> str:
        """Get graph schema information."""
        labels = await self.execute_cypher("CALL db.labels() YIELD label RETURN collect(label) as labels")
        rel_types = await self.execute_cypher("CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types")

        label_list = labels[0]["labels"] if labels else []
        rel_list = rel_types[0]["types"] if rel_types else []

        return f"Node Labels: {', '.join(label_list)}\nRelationship Types: {', '.join(rel_list)}"

    def close(self):
        if self._driver:
            self._driver.close()


# Singleton instance
_engine: Optional[KnowledgeGraphEngine] = None


def get_kg_engine() -> KnowledgeGraphEngine:
    """Get the knowledge graph engine singleton."""
    global _engine
    if _engine is None:
        _engine = KnowledgeGraphEngine()
    return _engine
