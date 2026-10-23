import math
import statistics
import decimal
import fractions
import time
import logging
from typing import Dict, Any

logger = logging.getLogger("securerag-sandbox")

# Safe whitelisted builtins
SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bin": bin,
    "bool": bool,
    "dict": dict,
    "divmod": divmod,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "format": format,
    "hex": hex,
    "int": int,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "oct": oct,
    "pow": pow,
    "range": range,
    "reversed": reversed,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
    "True": True,
    "False": False,
    "None": None,
}

SAFE_GLOBALS = {
    "__builtins__": SAFE_BUILTINS,
    "math": math,
    "statistics": statistics,
    "decimal": decimal,
    "fractions": fractions,
}


def run_restricted_python(code: str, timeout_seconds: float = 2.0) -> Dict[str, Any]:
    """
    Executes math/numerical Python snippet in a locked-down, restricted sandbox.
    Strips dangerous builtins (no os, sys, network, file IO, or subprocess).
    """
    # Pre-check dangerous keywords
    dangerous_keywords = ["import", "open", "exec", "eval", "subprocess", "os", "sys", "socket", "shutil", "__"]
    for kw in dangerous_keywords:
        if kw in code:
            return {
                "success": False,
                "error": f"Security restriction: '{kw}' is prohibited in math sandbox.",
                "output": None,
            }

    local_scope: Dict[str, Any] = {}
    stdout_capture = []

    def safe_print(*args):
        stdout_capture.append(" ".join(str(a) for a in args))

    exec_globals = dict(SAFE_GLOBALS)
    exec_globals["print"] = safe_print

    start_time = time.time()
    try:
        # Execute in restricted environment
        exec(code, exec_globals, local_scope)
        elapsed = round((time.time() - start_time) * 1000, 2)

        # Output priority: variable 'result' if set, else captured print, else last defined variable
        result_val = local_scope.get("result")
        if result_val is None and stdout_capture:
            result_val = "\n".join(stdout_capture)
        elif result_val is None and local_scope:
            # Get last non-private key
            keys = [k for k in local_scope.keys() if not k.startswith("_")]
            if keys:
                result_val = local_scope[keys[-1]]

        return {
            "success": True,
            "result": result_val,
            "stdout": "\n".join(stdout_capture),
            "latency_ms": elapsed,
        }

    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "output": None,
        }
