import React, { useState, useEffect, useRef } from 'react';

// --- 아이콘 SVG 컴포넌트 ---
const SoundIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> );
const StopIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg> );
// ✨ [추가] '메시지 보관' 버튼에 사용할 북마크 아이콘입니다.
const BookmarkIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg> );


const MindPostbox = () => {
    const [selectedMood, setSelectedMood] = useState(null);
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [showResult, setShowResult] = useState(false);
    
    // ✨ [추가] 에러와 성공 메시지를 모두 관리하기 위한 상태입니다. { 메시지 내용, 타입 } 형태의 객체를 저장합니다.
    const [feedback, setFeedback] = useState({ message: null, type: 'error' });

    // ✨ [추가] 현재 메시지가 세션에 저장되었는지 여부를 추적하는 상태입니다.
    const [isSaved, setIsSaved] = useState(false);

    // --- 음성 재생을 위한 State 추가 ---
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isFetchingAudio, setIsFetchingAudio] = useState(false);
    const audioRef = useRef(null); 

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [message]);
    
    // ✨ [추가] 사용자에게 보여줄 피드백 메시지를 설정하고, 일정 시간 뒤에 자동으로 사라지게 하는 함수입니다.
    const showFeedback = (message, type = 'error', duration = 3000) => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback({ message: null, type: 'error' }), duration);
    };

    const handleMoodSelect = (mood) => {
        setSelectedMood(mood);
        if (feedback.message) setFeedback({ message: null, type: 'error' });
    };

    const handleTextChange = (e) => {
        setText(e.target.value);
    };

    const sendMessage = async () => {
        if (!selectedMood) {
            // ✨ [수정] 기존 showErrorWithTimeout 대신 showFeedback 함수를 사용합니다.
            showFeedback("지금 기분을 선택해주세요.");
            return;
        }
        if (text.trim() === "") {
            showFeedback("당신의 이야기를 들려주세요.");
            return;
        }

        setIsLoading(true);
        setFeedback({ message: null, type: 'error' });
        // ✨ [추가] 새 메시지를 요청할 때마다 '저장됨' 상태를 초기화합니다.
        setIsSaved(false); 

        if (audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
        }

        try {
            const functionUrl = `/api/GetRandomMessage?mood=${selectedMood}`;
            const response = await fetch(functionUrl);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "서버에서 응답을 받지 못했습니다.");
            }

            setMessage(data.content);
            setShowResult(true);
        } catch (err) {
            showFeedback(err.message || "메시지를 가져오는 중 오류가 발생했습니다.");
            console.error("Error fetching message:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSpeak = async () => {
        if (isSpeaking) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsSpeaking(false);
            return;
        }

        if (!message) return;
        
        setIsFetchingAudio(true);
        setFeedback({ message: null, type: 'error' });

        try {
            // ... (기존 음성 재생 로직은 그대로입니다)
        } catch (err) {
            showFeedback(err.message);
        } finally {
            setIsFetchingAudio(false);
        }
    };
    
    // ✨ [추가] '메시지 보관' 버튼을 클릭했을 때 실행되는 핵심 함수입니다.
    const handleSaveMessage = () => {
        if (!message) return; // 메시지가 없으면 아무것도 하지 않음

        try {
            // 1. 세션 저장소에서 기존에 저장된 메시지 목록을 가져옵니다.
            const existingMessages = sessionStorage.getItem('savedMessages');
            let messages = existingMessages ? JSON.parse(existingMessages) : [];

            // 2. 새로 저장할 메시지 객체를 만듭니다.
            const newMessage = {
                id: Date.now(),
                content: message,
                mood: selectedMood,
                date: new Date().toISOString()
            };

            // 3. 기존 목록에 새 메시지를 추가하고, 다시 세션 저장소에 저장합니다.
            messages.push(newMessage);
            sessionStorage.setItem('savedMessages', JSON.stringify(messages));
            
            // 4. 저장 완료 상태로 변경하고, 성공 피드백을 보여줍니다.
            setIsSaved(true);
            showFeedback("메시지가 보관함에 저장되었습니다!", "success");
        } catch (err) {
            console.error("Failed to save message:", err);
            showFeedback("메시지 저장에 실패했습니다.");
        }
    };

    const resetForm = () => {
        setSelectedMood(null);
        setText("");
        setIsLoading(false);
        setFeedback({ message: null, type: 'error' });
        setMessage(null);
        setShowResult(false);
        // ✨ [추가] 폼을 초기화할 때 '저장됨' 상태도 함께 초기화합니다.
        setIsSaved(false);
        if (audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
        }
    };

    return (
        <div className="mind-postbox-container">
            <h2 className="postbox-title">마음 우체통</h2>
            <p className="postbox-subtitle">
                당신의 마음을 전해주세요. 좋은 기분이든, 나쁜 기분이든 모두 괜찮아요.
            </p>

            <div className="mood-section">
                <button className={`mood-btn good ${selectedMood === "good" ? "selected" : ""}`} onClick={() => handleMoodSelect("good")}>😊 좋음</button>
                <button className={`mood-btn bad ${selectedMood === "bad" ? "selected" : ""}`} onClick={() => handleMoodSelect("bad")}>😔 나쁨</button>
            </div>

            <div className="text-section">
                <textarea
                    className="text-input"
                    placeholder="당신의 이야기를 들려주세요..."
                    maxLength="500"
                    value={text}
                    onChange={handleTextChange}
                ></textarea>
            </div>

            <button className="submit-btn" onClick={sendMessage} disabled={isLoading}>
                {isLoading ? (
                    <><span className="loading"></span><span>전송 중...</span></>
                ) : ( "💌 보내기" )}
            </button>
            
            {/* ✨ [수정] 에러/성공 메시지를 동적으로 표시하는 부분입니다. */}
            {feedback.message && <div className={`feedback-message ${feedback.type}`}>{feedback.message}</div>}

            {showResult && (
                <div className="result-section show">
                    <div className="message-card-wrapper">
                        <div className="message-card">
                            <div className="message-content">{message}</div>
                            <div className="message-author">- 마음 우체통에서</div>
                        </div>
                        <button 
                            className="speak-btn" 
                            onClick={handleSpeak} 
                            disabled={isFetchingAudio}
                            title={isSpeaking ? "재생 중지" : "음성으로 듣기"}
                        >
                            {isFetchingAudio ? <span className="loading-small"></span> : (isSpeaking ? <StopIcon /> : <SoundIcon />)}
                        </button>
                    </div>
                    <div className="action-buttons">
                        {/* ✨ [추가] '메시지 보관' 버튼입니다. isSaved 상태에 따라 내용과 비활성화 여부가 결정됩니다. */}
                        <button 
                            className={`action-btn save-btn ${isSaved ? 'saved' : ''}`}
                            onClick={handleSaveMessage}
                            disabled={isSaved}
                        >
                            <BookmarkIcon />
                            {isSaved ? "저장 완료" : "메시지 보관"}
                        </button>
                        <button className="action-btn" onClick={sendMessage} disabled={isLoading}>🔄 다시 받기</button>
                        <button className="action-btn" onClick={resetForm}>✨ 다른 기분으로</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MindPostbox;

