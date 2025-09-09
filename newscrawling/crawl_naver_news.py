# crawl_naver_news.py
import time
import csv
import sys
from urllib.parse import urlparse, parse_qs
from datetime import datetime
from dateutil import tz
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://news.naver.com/main/list.naver"
DEFAULT_PARAMS = {
    "mode": "LSD",
    "mid": "sec",
    "sid1": "001",
    "listType": "title",
}
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Referer": "https://news.naver.com/",
    "Accept-Language": "ko,en;q=0.9",
}

def today_yyyymmdd_kst() -> str:
    kst = tz.gettz("Asia/Seoul")
    return datetime.now(tz=kst).strftime("%Y%m%d")

def build_url(date_str: str | None = None) -> str:
    params = DEFAULT_PARAMS.copy()
    params["date"] = date_str or today_yyyymmdd_kst()
    query = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"{BASE_URL}?{query}"

def extract_article_id(url: str) -> str:
    try:
        qs = parse_qs(urlparse(url).query)
        return (qs.get("aid") or [""])[0]
    except Exception:
        return ""

def _pick_title_anchor(li) -> tuple[str, str] | None:
    """
    li에서 기사 상세로 가는 대표 a 태그를 찾아 (title, href) 반환
    다양한 마크업에 견고하도록 여러 fallback을 둠
    """
    # 1) read.naver가 포함된 a 우선
    for sel in [
        "a[href*='read.naver']",
        "dt > a[href*='read.naver']",
        "dd > a[href*='read.naver']",
    ]:
        a = li.select_one(sel)
        if a and a.get("href"):
            return a.get_text(strip=True), a["href"].strip()

    # 2) 일반 a 태그 중 텍스트 길이가 있는 것
    for sel in [
        "dt > a",
        "a",
    ]:
        for a in li.select(sel):
            text = a.get_text(strip=True)
            href = (a.get("href") or "").strip()
            if text and href:
                return text, href
    return None

def fetch_center_titles(date_str: str | None = None, debug: bool = False) -> list[dict]:
    url = build_url(date_str)
    resp = requests.get(url, headers=HEADERS, timeout=12)
    status = resp.status_code

    if status != 200:
        if debug:
            with open("debug_response.html", "w", encoding="utf-8") as f:
                f.write(resp.text)
        raise RuntimeError(f"요청 실패: HTTP {status}")

    soup = BeautifulSoup(resp.text, "lxml")

    # 가운데 리스트 컨테이너를 여러 후보로 탐색
    container = (
        soup.select_one("#main_content .list_body.newsflash_body")
        or soup.select_one("#main_content .list_body")
        or soup.select_one("#main_content")
        or soup
    )

    # 대표 UL 2종 + 모든 li까지 폭넓게
    items = container.select("ul.type06_headline li, ul.type06 li")
    if not items:
        items = container.select("li")  # 구조 변경 대비

    results: list[dict] = []
    for li in items:
        picked = _pick_title_anchor(li)
        if not picked:
            continue
        title, link = picked

        # 이미지/광고성/빈 항목 제거
        if not title or not link.startswith("http"):
            # 상대경로면 절대경로 보정
            if link.startswith("/"):
                link = "https://news.naver.com" + link
            elif not link.startswith("http"):
                continue

        press = li.select_one(".writing")
        press_name = press.get_text(strip=True) if press else ""

        time_node = li.select_one(".date")
        time_text = time_node.get_text(strip=True) if time_node else ""

        results.append(
            {
                "aid": extract_article_id(link),
                "title": title,
                "link": link,
                "press": press_name,
                "time": time_text,
            }
        )

    # 디버그: 0건이면 HTML 저장해서 확인
    if not results and debug:
        with open("debug_dom_dump.html", "w", encoding="utf-8") as f:
            f.write(resp.text)
        print("디버그 파일 저장: debug_dom_dump.html (프로젝트 폴더 확인)")

    return results

def save_to_csv(rows: list[dict], path: str):
    if not rows:
        return
    fieldnames = ["aid", "title", "press", "time", "link"]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def run_once(date_str: str | None = None, to_csv: str | None = None, debug: bool = False):
    rows = fetch_center_titles(date_str, debug=debug)
    seen = set()
    uniq = []
    for r in rows:
        key = r.get("aid") or (r.get("title"), r.get("link"))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)

    print(f"[수집 {len(uniq)}건] date={date_str or today_yyyymmdd_kst()}")
    for i, r in enumerate(uniq, 1):
        print(f"{i:02d}. {r['title']}  | {r['press']}  | {r['time']}")
        print(f"    {r['link']}")

    if to_csv:
        save_to_csv(uniq, to_csv)
        print(f"\nCSV 저장: {to_csv}")

def run_realtime(poll_sec: int = 60, date_str: str | None = None, debug: bool = False):
    print(f"실시간 모니터링 시작 (interval={poll_sec}s, date={date_str or today_yyyymmdd_kst()})")
    seen_ids: set[str] = set()
    try:
        while True:
            rows = fetch_center_titles(date_str, debug=debug)
            new_rows = []
            for r in rows:
                aid = r.get("aid")
                key = aid or r.get("link")
                if key and key not in seen_ids:
                    seen_ids.add(key)
                    new_rows.append(r)

            if new_rows:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 새 기사 {len(new_rows)}건")
                for r in new_rows:
                    print(f"- {r['title']} | {r['press']} | {r['time']}")
                    print(f"  {r['link']}")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] 새 글 없음")

            time.sleep(poll_sec)
    except KeyboardInterrupt:
        print("\n종료합니다.")

if __name__ == "__main__":
    args = sys.argv[1:]
    live = False
    csv_path = None
    date_arg = None
    debug = False

    if "--live" in args:
        live = True
        args.remove("--live")
    if "--csv" in args:
        idx = args.index("--csv")
        try:
            csv_path = args[idx + 1]
        except IndexError:
            print("ERROR: --csv 다음에 파일명을 입력하세요.")
            sys.exit(1)
        del args[idx:idx + 2]
    if "--debug" in args:
        debug = True
        args.remove("--debug")

    if args:
        date_arg = args[0]

    if live:
        run_realtime(poll_sec=60, date_str=date_arg, debug=debug)
    else:
        run_once(date_str=date_arg, to_csv=csv_path, debug=debug)
