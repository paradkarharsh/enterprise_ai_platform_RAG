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


@router.get("/all")
async def get_all_graph(limit: int = 100, current_user: Optional[User] = Depends(get_optional_user)):
    """Retrieve all nodes and edges in the graph up to a limit."""
    engine = get_kg_engine()
    driver = engine._get_driver()
    if driver:
        cypher = f"""
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT {limit}
        """
        records = await engine.execute_cypher(cypher)
        nodes_dict = {}
        edges_list = []
        for rec in records:
            n = rec.get("n")
            if n:
                nid = n.element_id if hasattr(n, 'element_id') else n.get("name")
                nodes_dict[nid] = {
                    "id": nid,
                    "label": list(n.labels)[0] if hasattr(n, 'labels') and n.labels else "CONCEPT",
                    "name": n.get("name"),
                    "properties": dict(n)
                }
            m = rec.get("m")
            if m:
                mid = m.element_id if hasattr(m, 'element_id') else m.get("name")
                nodes_dict[mid] = {
                    "id": mid,
                    "label": list(m.labels)[0] if hasattr(m, 'labels') and m.labels else "CONCEPT",
                    "name": m.get("name"),
                    "properties": dict(m)
                }
            r = rec.get("r")
            if r and n and m:
                nid = n.element_id if hasattr(n, 'element_id') else n.get("name")
                mid = m.element_id if hasattr(m, 'element_id') else m.get("name")
                edges_list.append({
                    "source": nid,
                    "target": mid,
                    "type": r.type if hasattr(r, 'type') else "RELATED_TO",
                    "properties": dict(r)
                })
        return {"nodes": list(nodes_dict.values()), "edges": edges_list}

    # SQLite Fallback path
    try:
        from sqlalchemy import select
        from app.db.models import EntityNode, EntityRelationship
        from app.db.postgres import async_session

        async with async_session() as session:
            node_res = await session.execute(select(EntityNode).limit(limit))
            nodes = node_res.scalars().all()

            rel_res = await session.execute(select(EntityRelationship).limit(limit))
            rels = rel_res.scalars().all()

            nodes_data = [{
                "id": n.id,
                "label": n.entity_type,
                "name": n.id,
                "properties": n.properties or {}
            } for n in nodes]

            edges_data = [{
                "source": r.source,
                "target": r.target,
                "type": r.relationship,
                "properties": r.properties or {}
            } for r in rels]

            return {"nodes": nodes_data, "edges": edges_data}
    except Exception as e:
        logger.error("Failed to get all graph from SQLite fallback: %s", e)
        return {"nodes": [], "edges": []}
