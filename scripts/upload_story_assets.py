"""design/이미지의 콘텐츠 이미지를 Supabase Storage(story-assets 공개 버킷)에 업로드한다.

사용법:
  python scripts/upload_story_assets.py --dry-run   # 업로드 없이 fixtures/storage-assets.json만 생성
  python scripts/upload_story_assets.py             # 버킷 생성(없으면) + 전체 업로드 + json 갱신

인증: .env.local(또는 환경변수)의 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 사용.
서비스 키는 서버 전용 — 이 스크립트는 로컬에서만 실행하고 키를 커밋하지 않는다.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "design" / "이미지"
BUCKET = "story-assets"

# (원본 경로: design/이미지 기준, 스토리지 키)
# scenes 키는 fixtures/story.banggui.json의 external_id를 따른다 (07-1/07-2 = 대화3 분기)
ASSETS = [
    ("대표 이야기/대표 이야기_썸네일(제목O).png", "stories/banggui/thumbnail-titled.png"),
    ("대표 이야기/대표 이야기_썸네일(제목X).png", "stories/banggui/thumbnail.png"),
    ("대표 이야기/이야기 진행/도입_전개/도입.png", "stories/banggui/scenes/sc_banggui_01.png"),
    ("대표 이야기/이야기 진행/도입_전개/전개1.png", "stories/banggui/scenes/sc_banggui_02.png"),
    ("대표 이야기/이야기 진행/대화/대화1.png", "stories/banggui/scenes/sc_banggui_03.png"),
    ("대표 이야기/이야기 진행/도입_전개/전개2.png", "stories/banggui/scenes/sc_banggui_04.png"),
    ("대표 이야기/이야기 진행/대화/대화2.png", "stories/banggui/scenes/sc_banggui_05.png"),
    ("대표 이야기/이야기 진행/도입_전개/전개3.png", "stories/banggui/scenes/sc_banggui_06.png"),
    ("대표 이야기/이야기 진행/대화/대화3-1.png", "stories/banggui/scenes/sc_banggui_07-1.png"),
    ("대표 이야기/이야기 진행/대화/대화3-2.png", "stories/banggui/scenes/sc_banggui_07-2.png"),
    ("대표 이야기/이야기 진행/도입_전개/전개4.png", "stories/banggui/scenes/sc_banggui_08.png"),
    ("대표 이야기/이야기 진행/대화/대화4.png", "stories/banggui/scenes/sc_banggui_09.png"),
    ("대표 이야기/이야기 진행/미션/미션1.png", "stories/banggui/missions/mission-1.png"),
    ("대표 이야기/이야기 진행/미션/미션2.png", "stories/banggui/missions/mission-2.png"),
    ("대표 이야기/이야기 진행/대화 캐릭터 프로필/대화 프로필_방귀 며느리.png", "stories/banggui/characters/myeoneuri.png"),
    ("대표 이야기/이야기 진행/대화 캐릭터 프로필/대화 프로필_시아버지.png", "stories/banggui/characters/siabeoji.png"),
    ("대표 이야기/이야기 진행/대화 캐릭터 프로필/대화 프로필_마을이장.png", "stories/banggui/characters/ijang.png"),
    ("아이 프로필 캐릭터/캐릭터(남자1).png", "profiles/avatar/boy-1.png"),
    ("아이 프로필 캐릭터/캐릭터(남자2).png", "profiles/avatar/boy-2.png"),
    ("아이 프로필 캐릭터/캐릭터(여자1).png", "profiles/avatar/girl-1.png"),
    ("아이 프로필 캐릭터/캐릭터(여자2).png", "profiles/avatar/girl-2.png"),
    ("아이 프로필 캐릭터/배경 X/캐릭터 선택_남자 1.png", "profiles/select/boy-1.png"),
    ("아이 프로필 캐릭터/배경 X/캐릭터 선택_남자 2.png", "profiles/select/boy-2.png"),
    ("아이 프로필 캐릭터/배경 X/캐릭터 선택_여자 1.png", "profiles/select/girl-1.png"),
    ("아이 프로필 캐릭터/배경 X/캐릭터 선택_여자 2.png", "profiles/select/girl-2.png"),
    ("아이 프로필 캐릭터/배경 X/보호자.png", "profiles/select/guardian.png"),
    ("아이 프로필 캐릭터/boy 1.png", "profiles/select-bg/boy-1.png"),
    ("아이 프로필 캐릭터/boy 2.2.png", "profiles/select-bg/boy-2.png"),
    ("아이 프로필 캐릭터/girl 1.png", "profiles/select-bg/girl-1.png"),
    ("아이 프로필 캐릭터/girl 2.png", "profiles/select-bg/girl-2.png"),
    ("추천 이야기/추천 1_선녀와 나무꾼.png", "recommended/01-seonnyeo-namukkun.png"),
    ("추천 이야기/추천 2_해와 달이 된 오누이.png", "recommended/02-hae-dal-onui.png"),
    ("추천 이야기/추천 3_금도끼 은도끼.png", "recommended/03-geumdokki-eundokki.png"),
    ("추천 이야기/추천 4_토끼와 거북이.png", "recommended/04-tokki-geobuki.png"),
    ("추천 이야기/추천 5_혹부리 영감.png", "recommended/05-hokburi-yeonggam.png"),
    ("추천 이야기/추천 6_개미와 베짱이.png", "recommended/06-gaemi-bejjangi.png"),
    ("추천 이야기/추천 7_흥부와 놀부.png", "recommended/07-heungbu-nolbu.png"),
    # 단어장 (2.6) — 「0_단어장 파일 전달드립니다._260815」 원본을 design/이미지/단어장/으로 복사해 관리
    ("단어장/단어1_장대.png", "stories/banggui/wordbook/01-jangdae.png"),
    ("단어장/단어2_갓.png", "stories/banggui/wordbook/02-gat.png"),
    ("단어장/단어3_기왓장.png", "stories/banggui/wordbook/03-giwajang.png"),
    ("단어장/단어4_어리둥절하다.png", "stories/banggui/wordbook/04-eoridungjeol.png"),
    ("단어장/단어5_탐스럽다.png", "stories/banggui/wordbook/05-tamseureopda.png"),
]


def load_env():
    env = dict(os.environ)
    for name in (".env.local", ".env"):
        p = ROOT / name
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def request(method, url, key, body=None, content_type="application/json"):
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": content_type,
        # 재업로드 시 덮어쓰기 — 쿼리 ?upsert=true는 무시되고 409가 난다(헤더가 정식 방법)
        "x-upsert": "true",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="업로드 없이 매핑 json만 생성")
    args = ap.parse_args()

    env = load_env()
    base = env.get("SUPABASE_URL", "https://lpiqyaqajlxhnvumvjvb.supabase.co").rstrip("/")

    missing = [src for src, _ in ASSETS if not (IMG / src).exists()]
    if missing:
        sys.exit(f"원본 파일 누락 {len(missing)}건: " + ", ".join(missing[:5]))

    mapping = {
        "bucket": BUCKET,
        "base_url": f"{base}/storage/v1/object/public/{BUCKET}",
        "note": "public_url = base_url + '/' + key. 원본은 design/이미지 (git 미추적).",
        "assets": [{"key": key, "source": f"design/이미지/{src}"} for src, key in ASSETS],
    }
    out = ROOT / "fixtures" / "storage-assets.json"
    out.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"매핑 작성: {out.relative_to(ROOT)} ({len(ASSETS)}건)")

    if args.dry_run:
        return

    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SECRET_KEY")
    if not key:
        sys.exit("SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local에 추가 후 재실행하세요.")

    status, body = request("POST", f"{base}/storage/v1/bucket", key,
                           json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode())
    if status not in (200, 201) and "already exists" not in body.lower() and status != 409:
        sys.exit(f"버킷 생성 실패 [{status}]: {body}")
    print(f"버킷 확인: {BUCKET}")

    ok = 0
    for src, key_path in ASSETS:
        data = (IMG / src).read_bytes()
        # 1KB 미만은 플레이스홀더 스텁(대표 썸네일 등 로컬 미보유) — 업로드하면 스토리지의 정상본을 덮어쓴다
        if len(data) < 1024:
            print(f"  - {key_path} 건너뜀 (로컬 파일 {len(data)}B — 스텁 의심)")
            continue
        status, body = request("POST", f"{base}/storage/v1/object/{BUCKET}/{key_path}",
                               key, data, "image/png")
        if status in (200, 201):
            ok += 1
            print(f"  ↑ {key_path} ({len(data) // 1024}KB)")
        else:
            print(f"  ✗ {key_path} [{status}]: {body[:120]}")
    print(f"완료: {ok}/{len(ASSETS)} 업로드")
    if ok < len(ASSETS):
        sys.exit(1)


if __name__ == "__main__":
    main()
