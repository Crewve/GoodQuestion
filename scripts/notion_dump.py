"""Dump a public notion.site page (and child pages) to readable text via internal API."""
import json, sys, urllib.request

BASE = "https://dour-lamprey-1bc.notion.site/api/v3/loadCachedPageChunkV2"

def fmt_uuid(s):
    s = s.replace("-", "")
    return f"{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}"

def load_page(page_id):
    """Fetch all chunks for a page, return merged block map."""
    blocks = {}
    collections = {}
    cursor = {"stack": []}
    chunk = 0
    while True:
        body = json.dumps({
            "page": {"id": page_id},
            "limit": 100,
            "cursor": cursor,
            "chunkNumber": chunk,
            "verticalColumns": False,
        }).encode()
        req = urllib.request.Request(BASE, data=body, headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        for bid, wrap in data.get("recordMap", {}).get("block", {}).items():
            v = wrap.get("value", {})
            if "value" in v:  # nested value.value shape
                v = v["value"]
            if v:
                blocks[bid] = v
        for cid, wrap in data.get("recordMap", {}).get("collection", {}).items():
            v = wrap.get("value", {})
            if "value" in v:
                v = v["value"]
            if v:
                collections[cid] = v
        cursors = data.get("cursors") or []
        if not cursors:
            break
        cursor = cursors[0]
        chunk += 1
        if chunk > 30:
            break
    return blocks, collections

SYNC = "https://dour-lamprey-1bc.notion.site/api/v3/syncRecordValues"
SPACE = "5be761d9-1d52-4bca-957e-f0a0ce9c1fe7"

def fetch_missing(blocks):
    """Repeatedly fetch blocks referenced in content[] but absent, by loading each as a page root."""
    tried = set()
    for _round in range(30):
        missing = []
        for b in list(blocks.values()):
            for cid in b.get("content", []) or []:
                if cid not in blocks and cid not in tried:
                    missing.append(cid)
        missing = list(dict.fromkeys(missing))
        if not missing:
            return
        sys.stderr.write(f"round {_round}: {len(missing)} missing\n")
        for m in missing:
            tried.add(m)
            try:
                sub, _ = load_page(m)
                for bid, v in sub.items():
                    if bid not in blocks:
                        blocks[bid] = v
            except Exception as e:
                sys.stderr.write(f"  fail {m}: {e}\n")
            if m not in blocks:
                blocks[m] = {"type": "unresolved", "content": []}

def rt(prop):
    """Flatten notion rich-text array to plain string."""
    if not prop:
        return ""
    out = []
    for seg in prop:
        if isinstance(seg, list) and seg:
            out.append(str(seg[0]))
    return "".join(out)

def render(blocks, bid, depth=0, out=None, seen=None):
    if out is None:
        out = []
    if seen is None:
        seen = set()
    if bid in seen:
        return out
    seen.add(bid)
    b = blocks.get(bid)
    if not b:
        out.append("  " * depth + f"[missing block {bid}]")
        return out
    t = b.get("type", "?")
    props = b.get("properties", {}) or {}
    title = rt(props.get("title"))
    ind = "  " * depth
    if t == "page":
        out.append(f"{ind}# PAGE: {title}  [id={bid}]")
    elif t == "child_page":
        out.append(f"{ind}## CHILD PAGE: {title}  [id={bid}]")
    elif t in ("header", "sub_header", "sub_sub_header"):
        lvl = {"header": "#", "sub_header": "##", "sub_sub_header": "###"}[t]
        out.append(f"{ind}{lvl} {title}")
    elif t == "toggle":
        out.append(f"{ind}▸ {title}")
    elif t == "table":
        out.append(f"{ind}[TABLE]")
    elif t == "table_row":
        cells = []
        for k in sorted(props.keys()):
            cells.append(rt(props[k]))
        out.append(f"{ind}| " + " | ".join(cells) + " |")
    elif t == "collection_view_page" or t == "collection_view":
        out.append(f"{ind}[DATABASE {t}: {title or b.get('collection_id','')}]")
    elif t == "divider":
        out.append(f"{ind}---")
    elif t == "callout":
        out.append(f"{ind}📌 {title}")
    elif t == "quote":
        out.append(f"{ind}> {title}")
    elif t in ("bulleted_list", "numbered_list", "to_do"):
        out.append(f"{ind}- {title}")
    elif t == "code":
        out.append(f"{ind}```\n{title}\n{ind}```")
    else:
        if title:
            out.append(f"{ind}{title}")
        elif t not in ("column", "column_list", "image", "bookmark"):
            out.append(f"{ind}[{t}]")
    for cid in b.get("content", []) or []:
        # don't descend into child pages here; list them only
        child = blocks.get(cid, {})
        if child.get("type") == "page":
            ct = rt((child.get("properties") or {}).get("title"))
            out.append("  " * (depth + 1) + f"## LINKED/CHILD PAGE: {ct}  [id={cid}]")
            continue
        render(blocks, cid, depth + 1, out, seen)
    return out

if __name__ == "__main__":
    pid = fmt_uuid(sys.argv[1])
    blocks, colls = load_page(pid)
    sys.stderr.write(f"blocks: {len(blocks)}, collections: {len(colls)}\n")
    fetch_missing(blocks)
    sys.stderr.write(f"after sync: {len(blocks)} blocks\n")
    lines = render(blocks, pid)
    text = "\n".join(lines)
    sys.stdout.buffer.write(text.encode("utf-8"))
