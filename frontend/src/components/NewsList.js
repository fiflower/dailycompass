// frontend/src/components/NewsList.jsx
import React, { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || ""; // 프록시 사용 시 빈 문자열

export default function NewsList({ date }) {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState(""); // ← 크롤러 소스 저장

  useEffect(() => {
    let alive = true;
    setPending(true);
    setError("");
    setCode("");

    const url = date
      ? `${API_BASE}/api/news?date=${encodeURIComponent(date)}`
      : `${API_BASE}/api/news`;

    fetch(url)
      .then(async (res) => {
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};
        if (!res.ok) {
          const msg = data.error ? `${data.error}` : `HTTP ${res.status}`;
          const err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        const list = Array.isArray(data) ? data : (data.items || []);
        if (alive) setItems(list);
      })
      .catch(async (err) => {
        if (!alive) return;
        setError(err.message || "뉴스 로딩 실패");
        // 에러가 나면 크롤러 소스코드를 불러와서 보여줌
        try {
          const r = await fetch(`${API_BASE}/api/debug/crawler`);
          const t = await r.text();
          if (alive) setCode(t);
        } catch (_) {}
      })
      .finally(() => alive && setPending(false));

    return () => { alive = false; };
  }, [date]);

  if (pending) return <div className="news-loading">불러오는 중…</div>;

  if (error) {
    return (
      <div className="news-error">
        <div style={{ marginBottom: 8 }}>오류: {error}</div>
        {code && (
          <details open>
            <summary>crawl_naver_news.py</summary>
            <pre className="code-block">{code}</pre>
          </details>
        )}
      </div>
    );
  }

  if (!items.length) return <div className="news-empty">표시할 뉴스가 없습니다.</div>;

  return (
    <ul className="news-list">
      {items.map((n) => (
        <li key={n.aid || n.link} className="news-item">
          <a className="news-title" href={n.link} target="_blank" rel="noreferrer">
            {n.title}
          </a>
          <div className="news-meta">
            <span className="news-press">{n.press || "언론사 미상"}</span>
            {n.time && <span className="news-time"> · {n.time}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
