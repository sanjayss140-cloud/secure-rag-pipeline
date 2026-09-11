import sys
import json
from pathlib import Path

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.security.sanitizer import detect_prompt_injection
from backend.rag.agent import run_rag_agent
from backend.database.session import SessionLocal, init_db

EVAL_FILE = PROJECT_ROOT / "tests" / "evals" / "rag_eval.json"


def run_evaluation():
    print("=" * 70)
    print("           SECURERAG EMPIRICAL BENCHMARK EVALUATION")
    print("=" * 70)

    if not EVAL_FILE.exists():
        print(f"Error: Evaluation file not found at {EVAL_FILE}")
        return

    with open(EVAL_FILE, "r", encoding="utf-8") as f:
        cases = json.load(f)

    init_db()
    db = SessionLocal()

    total_tests = len(cases)
    passed_tests = 0
    injection_tests = 0
    injection_blocked = 0
    refusal_tests = 0
    refusal_correct = 0

    results = []

    for item in cases:
        test_id = item["id"]
        category = item["category"]
        question = item["question"]
        expected_keywords = item["expected_keywords"]
        expected_refusal = item.get("expected_refusal", False)
        is_injection_case = item.get("prompt_injection", False)

        print(f"\n[Test {test_id}] Category: {category}")
        print(f"Query: {question}")

        # Check injection defense directly
        is_suspicious, reason = detect_prompt_injection(question)

        if is_injection_case:
            injection_tests += 1
            if is_suspicious:
                injection_blocked += 1
                passed = True
                print("-> Defense Result: Injection successfully detected & blocked.")
            else:
                passed = False
                print("-> Defense Result: FAILED to detect injection pattern.")
        else:
            if expected_refusal:
                refusal_tests += 1
                # Run through agent
                resp = run_rag_agent(question, "eval_user", db)
                ans_lower = resp.answer.lower()
                matched = any(k.lower() in ans_lower for k in expected_keywords)
                if matched or not resp.grounded:
                    refusal_correct += 1
                    passed = True
                    print(f"-> Refusal Result: Correctly refused unsupported question.")
                else:
                    passed = False
                    print(f"-> Refusal Result: Failed refusal. Answer: {resp.answer[:80]}...")
            else:
                resp = run_rag_agent(question, "eval_user", db)
                ans_lower = resp.answer.lower()
                matched_keywords = [k for k in expected_keywords if k.lower() in ans_lower]
                passed = len(matched_keywords) > 0 or len(resp.sources) > 0
                print(f"-> Retrieval Result: Grounded={resp.grounded}, Sources={len(resp.sources)}, Confidence={resp.confidence}")

        if passed:
            passed_tests += 1
            print("Status: PASS [OK]")
        else:
            print("Status: FAIL [X]")

        results.append({
            "id": test_id,
            "category": category,
            "passed": passed,
        })

    db.close()

    accuracy = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
    injection_rate = (injection_blocked / injection_tests) * 100 if injection_tests > 0 else 100.0

    print("\n" + "=" * 70)
    print("                     EVALUATION SUMMARY")
    print("=" * 70)
    print(f"Total Benchmark Cases Evaluated : {total_tests}")
    print(f"Passed                          : {passed_tests}/{total_tests} ({accuracy:.1f}%)")
    print(f"Prompt Injection Defense Rate   : {injection_blocked}/{injection_tests} ({injection_rate:.1f}%)")
    print(f"Refusal Accuracy                : {refusal_correct}/{refusal_tests}")
    print("=" * 70)

    return {
        "total_tests": total_tests,
        "passed": passed_tests,
        "accuracy_pct": accuracy,
        "injection_defense_pct": injection_rate,
    }


if __name__ == "__main__":
    run_evaluation()
