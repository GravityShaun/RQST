#!/usr/bin/env python3
"""Move module-level StyleSheet.create blocks into useThemedStyles hooks."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def extract_styles_block(content: str) -> tuple[str, str, str] | None:
    marker = "const styles = StyleSheet.create({"
    idx = content.rfind(marker)
    if idx == -1:
        return None

    brace_start = content.index("{", idx + len("const styles = StyleSheet.create("))
    depth = 0
    i = brace_start
    while i < len(content):
        char = content[i]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = content.index(");", i) + 3
                styles_block = content[idx:end]
                inner = styles_block[len("const styles = StyleSheet.create(") :].strip()
                if inner.endswith("});"):
                    inner = inner[:-3]
                elif inner.endswith(");"):
                    inner = inner[:-2]
                inner = inner.strip()
                if inner.startswith("{") and inner.endswith("}"):
                    inner = inner[1:-1].strip()
                inner = inner.replace("premiumTheme", "activeTheme")
                inner = inner.strip()
                if inner.startswith("{"):
                    inner = inner[1:].lstrip()
                if inner.endswith("}"):
                    inner = inner[:-1].rstrip()
                remaining = content[:idx].rstrip() + "\n"
                return styles_block, inner, remaining
        i += 1
    return None


def add_theme_import(content: str, theme_import: str) -> str:
    if "useThemedStyles" in content:
        return content

    import_line = f'import {{ usePremiumTheme, useThemedStyles }} from "{theme_import}";\n'
    match = re.search(r"^import .+;\n", content, re.MULTILINE)
    if match:
        insert_at = match.end()
        while insert_at < len(content) and content[insert_at : insert_at + 7] == "import ":
            next_match = re.search(r"^import .+;\n", content[insert_at:], re.MULTILINE)
            if not next_match:
                break
            insert_at += next_match.end()
        return content[:insert_at] + import_line + content[insert_at:]
    return import_line + content


def remove_premium_theme_import(content: str) -> str:
    content = re.sub(r",\s*premiumTheme\s*,", ", ", content)
    content = re.sub(r",\s*premiumTheme\s*\}", " }", content)
    content = re.sub(r"\{\s*premiumTheme\s*,", "{ ", content)
    content = re.sub(r",\s*premiumTheme\s*\n", "\n", content)
    content = re.sub(r"import \{ premiumTheme \} from [^;]+;\n", "", content)
    return content


def inject_styles_hook(content: str, styles_inner: str) -> str:
    match = re.search(r"export default function \w+\([^)]*\) \{", content)
    if not match:
        match = re.search(r"export function \w+\([^)]*\) \{", content)
    if not match:
        raise ValueError("export function not found")

    insert_at = match.end()
    hook = (
        "\n  const theme = usePremiumTheme();\n"
        "  const styles = useThemedStyles((activeTheme) =>\n"
        "    StyleSheet.create({\n"
        f"{styles_inner}\n"
        "    }),\n"
        "  );\n"
    )

    if "const styles = useThemedStyles" in content[insert_at : insert_at + 200]:
        return content

    return content[:insert_at] + hook + content[insert_at:]


def replace_inline_theme_refs(content: str) -> str:
    return content.replace("premiumTheme.colors", "theme.colors").replace(
        "premiumTheme.fonts", "theme.fonts"
    ).replace("premiumTheme.radii", "theme.radii")


def convert_file(path: Path, theme_import: str) -> None:
    content = path.read_text()
    if "useThemedStyles" in content and "const styles = StyleSheet.create" not in content:
        print(f"skip {path}")
        return

    extracted = extract_styles_block(content)
    if not extracted:
        print(f"no styles block {path}")
        return

    _, styles_inner, remaining = extracted
    content = remaining
    content = add_theme_import(content, theme_import)
    content = remove_premium_theme_import(content)
    content = inject_styles_hook(content, styles_inner)
    content = replace_inline_theme_refs(content)
    path.write_text(content)
    print(f"converted {path}")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: convert-themed-styles.py <file>...")
        return 1

    for arg in argv[1:]:
        path = Path(arg)
        depth = len(path.parts) - len(Path("mobile/app/(tabs)/x.tsx").parts)
        if "app/" in str(path):
            theme_import = "../../src/store/theme"
            if "profile" in str(path) or "dj.tsx" in str(path):
                theme_import = "../src/store/theme"
        else:
            theme_import = "../store/theme"
        convert_file(path, theme_import)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
