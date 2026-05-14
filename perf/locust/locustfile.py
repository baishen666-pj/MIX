"""Locust realistic user simulation for MIX performance testing."""

from __future__ import annotations

import json
import random
import time
from locust import HttpUser, task, between, events

CHAT_MESSAGES = [
    "What's the weather like today?",
    "Help me write a Python function to sort a list",
    "Summarize the key points of machine learning",
    "Translate this to French: Good morning",
    "Debug this code: print(xyz)",
    "How do I create a Docker container?",
    "Explain async/await in JavaScript",
    "Write a SQL query for top 10 customers",
    "What are the benefits of microservices?",
    "Compare React vs Vue.js",
    "How to optimize database queries?",
    "Explain the SOLID principles",
    "Write a regex for email validation",
    "What is the difference between PUT and PATCH?",
    "How to implement rate limiting?",
    "Explain WebSocket vs Server-Sent Events",
    "What is a message queue and when to use it?",
    "How do I set up CI/CD pipeline?",
    "Explain OAuth 2.0 flow",
    "What are design patterns in Python?",
    "How to handle errors in async code?",
    "Write unit tests for a REST API",
    "Explain event-driven architecture",
    "How to secure a REST API?",
    "What is the CAP theorem?",
    "Compare SQL vs NoSQL databases",
    "How to implement pagination?",
    "Explain the CQRS pattern",
    "What is domain-driven design?",
    "How to monitor microservices?",
]

SEARCH_QUERIES = [
    "project requirements",
    "meeting notes",
    "code review feedback",
    "deployment steps",
    "configuration changes",
    "bug report details",
    "performance metrics",
    "user feedback",
    "test results",
    "architecture decisions",
]


class MIXUser(HttpUser):
    wait_time = between(1, 5)

    @task(40)
    def chat(self):
        msg = random.choice(CHAT_MESSAGES)
        self.client.post(
            "/api/chat",
            json={"message": msg, "session_id": f"locust-{self.user_id}"},
            name="/api/chat",
        )

    @task(25)
    def browse_marketplace(self):
        queries = ["", "weather", "automation", "data", "developer"]
        categories = ["", "utilities", "developer", "ai", "data"]
        params = {}
        q = random.choice(queries)
        cat = random.choice(categories)
        if q:
            params["q"] = q
        if cat:
            params["category"] = cat
        self.client.get(
            "/api/plugins/marketplace",
            params=params,
            name="/api/plugins/marketplace",
        )

    @task(20)
    def search_memory(self):
        query = random.choice(SEARCH_QUERIES)
        self.client.post(
            "/api/memory/search",
            json={"query": query, "limit": random.randint(5, 20)},
            name="/api/memory/search",
        )

    @task(10)
    def sse_stream(self):
        with self.client.get(
            "/api/chat/stream",
            params={"message": "Locust stream test", "session_id": f"locust-stream-{self.user_id}"},
            name="/api/chat/stream",
            stream=True,
            timeout=10,
        ) as resp:
            for _ in resp.iter_lines():
                pass

    @task(5)
    def check_metrics(self):
        self.client.get("/api/metrics", name="/api/metrics")
