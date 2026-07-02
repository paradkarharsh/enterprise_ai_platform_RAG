"""Knowledge Graph API route."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth.jwt import get_optional_user
from app.db.models import User
from app.knowledge_graph.engine import get_kg_engine

logger = logging.getLogger(__name__)
router = APIRouter()


class GraphQueryRequest(BaseModel):
    query: Optional[str] = None
    cypher: Optional[str] = None
    entity_name: Optional[str] = None
    depth: int = 2


@router.post("/query")
async def graph_query(request: GraphQueryRequest, current_user: Optional[User] = Depends(get_optional_user)):
    """Query the knowledge graph with natural language or Cypher."""
    engine = get_kg_engine()
    if request.cypher:
        results = await engine.execute_cypher(request.cypher)
        return {"results": results, "cypher": request.cypher}
    elif request.query:
        cypher = await engine.natural_language_to_cypher(request.query)
        results = await engine.execute_cypher(cypher)
        return {"results": results, "cypher": cypher}
    elif request.entity_name:
        graph = await engine.get_entity_relationships(request.entity_name, request.depth)
        return {"nodes": graph.nodes, "edges": graph.edges}
    return {"error": "Provide query, cypher, or entity_name"}


@router.get("/stats")
async def graph_stats(current_user: Optional[User] = Depends(get_optional_user)):
    """Get knowledge graph statistics."""
    engine = get_kg_engine()
    return await engine.get_graph_stats()


@router.get("/search/{query}")
async def search_entities(query: str, entity_type: Optional[str] = None):
    """Search entities in the knowledge graph."""
    engine = get_kg_engine()
    return await engine.search_entities(query, entity_type)
