from pathlib import Path
import json
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from retriever import get_relevant_documents


EVALUATION_FILE = (
    PROJECT_ROOT / "tests" / "evaluation_questions.json"
)


def load_questions():
    with open(
        EVALUATION_FILE,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def inspect_retrieval():
    questions = load_questions()

    for item in questions:
        question = item["question"]

        print("\n" + "=" * 70)
        print("QUESTION:", question)
        print("=" * 70)

        docs = get_relevant_documents(question)

        for i, doc in enumerate(docs, start=1):
            print(f"\n--- RETRIEVED CHUNK {i} ---")
            print("SOURCE:", doc.metadata.get("source"))
            print("PAGE:", doc.metadata.get("page"))
            print("METHOD:", doc.metadata.get("method"))
            print("\nCONTENT:")
            print(doc.page_content)
            print("\n" + "-" * 70)


if __name__ == "__main__":
    inspect_retrieval()