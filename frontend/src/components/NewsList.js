import React, { useEffect, useMemo, useState } from "react";

// 백엔드 API 서버의 전체 주소를 명시적으로 지정합니다.
const API_BASE = "http://localhost:7071";

export default function NewsList({ date }) {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(4); // 처음 4개만 표시

  useEffect(() => {
    let alive = true;
    setPending(true);
    setError("");
    setVisibleCount(4); // 날짜가 변경될 때마다 표시 개수 초기화

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
        const list = Array.isArray(data.items) ? data.items : [];
        if (alive) setItems(list);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || "뉴스 로딩 실패");
      })
      .finally(() => alive && setPending(false));

    return () => {
      alive = false;
    };
  }, [date]);

  // 화면에 보여줄 항목들
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );
  const canLoadMore = visibleCount < items.length;

  return (
    <section className="news-section">
      <div className="news-header">
        <h2>실시간 뉴스</h2>
      </div>

      <div className="news-content">
        {pending && <div className="news-loading">불러오는 중…</div>}

        {!pending && error && (
          <div className="news-error">
            <div style={{ marginBottom: 8 }}>오류: {error}</div>
          </div>
        )}

        {!pending && !error && (
          <>
            {visibleItems.length === 0 ? (
              <div className="news-empty">표시할 뉴스가 없습니다.</div>
            ) : (
              <ul className="news-list">
                {visibleItems.map((n) => (
                  <li key={n.aid || n.link} className="news-item">
                    <a
                      className="news-title"
                      href={n.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {n.title}
                    </a>
                    <div className="news-meta">
                      <span className="news-press">
                        {n.press || "언론사 미상"}
                      </span>
                      {n.time && <span className="news-time"> · {n.time}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {canLoadMore && !pending && !error && (
        <button
          className="load-more-btn"
          onClick={() =>
            setVisibleCount((c) => Math.min(c + 6, items.length))
          }
        >
          더보기
        </button>
      )}
    </section>
  );
}

