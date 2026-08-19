import os
from langchain_openai import ChatOpenAI

if os.getenv("GROQ_API_KEY"):
    llm = ChatOpenAI(
        model="qwen/qwen3.6-27b",
        temperature=0,
        api_key=os.environ["GROQ_API_KEY"],
        base_url="https://api.groq.com/openai/v1",
    )
else:
    from langchain_ollama import ChatOllama

    llm = ChatOllama(
        model="qwen2.5:3b",
        temperature=0,
    )
