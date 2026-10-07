"""
Interactive CLI — the Phase 0 test interface.
Usage: python cli.py [--folder FOLDER_ID]
"""

import sys
import argparse
from datetime import datetime

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    from rich.table import Table
    from rich import print as rprint
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

import agent
import store
import vertical as vert_loader
import config

console = Console() if HAS_RICH else None


def print_banner():
    v = vert_loader.load_vertical()
    name = v.get("name", "Generic")
    msg = f"Saravonix Local Memory Engine · {name}\nType your question. /quit to exit. /folders to list. /help for commands."
    if HAS_RICH:
        console.print(Panel(msg, style="bold blue"))
    else:
        print("=" * 60)
        print(msg)
        print("=" * 60)


def print_result(result: dict):
    ans = result["answer"]
    sources = result["sources"]
    timing = result["timing"]
    backend = result["backend_used"]
    escalated = result["escalated"]

    if HAS_RICH:
        # Answer panel
        style = "yellow" if escalated else "green"
        tag = f"[cloud:{backend}]" if escalated else f"[local:{backend}]"
        console.print(Panel(ans, title=f"Answer {tag}", border_style=style))

        # Sources table
        if sources:
            table = Table(title="Sources", show_lines=True)
            table.add_column("File", style="cyan", max_width=35)
            table.add_column("Page", style="magenta", width=6)
            table.add_column("Passage", style="white", max_width=60)
            for s in sources:
                table.add_row(
                    s["file"],
                    str(s["page"] or "—"),
                    s["passage"][:120] + "…" if len(s["passage"]) > 120 else s["passage"],
                )
            console.print(table)

        # Timing
        console.print(
            f"  [dim]retrieval {timing['retrieval_ms']}ms · "
            f"generation {timing['generation_ms']}ms · "
            f"total {timing['total_ms']}ms[/dim]"
        )
    else:
        print(f"\nAnswer [{backend}{'*' if escalated else ''}]:")
        print(ans)
        if sources:
            print("\nSources:")
            for s in sources:
                print(f"  {s['file']} p.{s['page'] or '?'} — {s['passage'][:100]}…")
        print(f"\n[retrieval {timing['retrieval_ms']}ms | generation {timing['generation_ms']}ms | total {timing['total_ms']}ms]")


def handle_command(cmd: str, folder_id: str) -> bool:
    """Returns True if the command was handled (don't treat as query)."""
    cmd = cmd.strip()

    if cmd in ("/quit", "/exit", "/q"):
        print("Goodbye.")
        sys.exit(0)

    elif cmd == "/folders":
        with store.get_db_context() as db:
            folders = store.list_matters_files_stats(db)
        if not folders:
            print("No documents ingested yet.")
        else:
            for f in folders:
                print(f"  [{f['matter_id']}] {f['file_count']} files, {f['chunk_count']} chunks — last: {f.get('last_updated', 'N/A')}")
        return True

    elif cmd.startswith("/files"):
        parts = cmd.split()
        fid = parts[1] if len(parts) > 1 else folder_id
        with store.get_db_context() as db:
            files = store.matter_files(db, fid)
        if not files:
            print(f"No files in folder '{fid}'")
        else:
            for f in files:
                print(f"  {f['source_file']} ({f['doc_type']}) — {f['chunks']} chunks")
        return True

    elif cmd == "/help":
        print("""
Commands:
  /folders          — list all folders/matters with file counts
  /files [folder]   — list files in a folder (default: current folder)
  /cloud on|off     — force cloud or local for next query
  /quit             — exit

Everything else is treated as a question about your documents.
""")
        return True

    return False


def main():
    parser = argparse.ArgumentParser(description="Saravonix Local Memory Engine CLI")
    parser.add_argument("--folder", default=None, help="Restrict answers to this folder/matter ID")
    parser.add_argument("--cloud", action="store_true", help="Force cloud LLM backend")
    args = parser.parse_args()

    folder_id = args.folder
    force_cloud = args.cloud

    print_banner()

    if folder_id:
        print(f"Searching folder: {folder_id}")
    else:
        print("Searching all folders. Use --folder MATTER_ID to narrow scope.")
    print()

    while True:
        try:
            if HAS_RICH:
                query = console.input("[bold cyan]You:[/bold cyan] ").strip()
            else:
                query = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye.")
            break

        if not query:
            continue

        if handle_command(query, folder_id or "default"):
            continue

        try:
            result = agent.answer(query, matter_id=folder_id, force_cloud=force_cloud)
            print_result(result)
        except Exception as e:
            print(f"Error: {e}")

        print()


if __name__ == "__main__":
    main()
