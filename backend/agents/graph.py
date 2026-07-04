"""Compile the AlphaScribe LangGraph."""
from __future__ import annotations
from functools import partial
from langgraph.graph import StateGraph, START, END
from .state import AgentState
from .nodes import (
    retriever_node,
    financial_extractor_node,
    tone_risk_node,
    synthesizer_node,
    fact_checker_node,
    fact_check_router,
)


def build_graph(db):
    g = StateGraph(AgentState)

    g.add_node("retriever", partial(retriever_node, db=db))
    g.add_node("extractor", financial_extractor_node)
    g.add_node("tone", tone_risk_node)
    g.add_node("synthesizer", synthesizer_node)
    g.add_node("fact_checker", fact_checker_node)

    # Retrieval → parallel Extractor + Tone
    g.add_edge(START, "retriever")
    g.add_edge("retriever", "extractor")
    g.add_edge("retriever", "tone")

    # Both parallel branches feed synthesizer (LangGraph handles fan-in)
    g.add_edge("extractor", "synthesizer")
    g.add_edge("tone", "synthesizer")

    g.add_edge("synthesizer", "fact_checker")
    g.add_conditional_edges(
        "fact_checker",
        fact_check_router,
        {
            "accept": END,
            "retry": "synthesizer",
            "give_up": END,
        },
    )
    return g.compile()
