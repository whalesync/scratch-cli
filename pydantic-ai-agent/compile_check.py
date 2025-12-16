#!/usr/bin/env python3
"""
Compile check script for all Python application files in pydantic-ai-agent.
This will check for syntax errors in all Python files.
"""
import py_compile
import sys
from pathlib import Path


def compile_all_python_files(root_dir: Path) -> tuple[int, int, list[str]]:
    """
    Compile all Python files in the directory tree.
    Returns (file_count, error_count, error_messages)
    """
    errors = []
    error_count = 0

    # Directories to skip
    skip_dirs = {"venv", ".venv", "__pycache__", ".git", ".mypy_cache", ".pytest_cache"}

    # Find all Python files, ensuring they're within root_dir
    root_resolved = root_dir.resolve()
    python_files = []
    for py_file in root_dir.rglob("*.py"):
        # Ensure file is actually within root_dir (not a symlink outside)
        try:
            if not py_file.resolve().is_relative_to(root_resolved):
                continue
        except (ValueError, RuntimeError):
            # Handle case where resolve() fails (broken symlink, etc.)
            continue

        # Skip files in excluded directories
        if any(skip_dir in py_file.parts for skip_dir in skip_dirs):
            continue
        python_files.append(py_file)

    print(f"Checking {len(python_files)} Python files...")

    for py_file in sorted(python_files):
        try:
            py_compile.compile(str(py_file), doraise=True)
        except py_compile.PyCompileError as e:
            error_count += 1
            error_msg = f"ERROR in {py_file.relative_to(root_dir)}: {e}"
            errors.append(error_msg)
            print(error_msg, file=sys.stderr)

    return len(python_files), error_count, errors


if __name__ == "__main__":
    root = Path(__file__).parent
    file_count, error_count, errors = compile_all_python_files(root)

    if error_count == 0:
        print(f"✓ All {file_count} Python files compiled successfully!")
        sys.exit(0)
    else:
        print(f"\n✗ Found {error_count} file(s) with syntax errors", file=sys.stderr)
        sys.exit(1)
