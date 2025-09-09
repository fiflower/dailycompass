import React from 'react';
import MindPostbox from './MindPostbox';
import TodoList from './TodoList';
import NewsList from './NewsList';

const MainPage = ({ user, onLogout }) => {
    // 실제 사용자 객체는 user.user에 있습니다.
    const actualUser = user.user;

    // 만약 actualUser가 없으면 렌더링하지 않도록 방어 코드를 추가합니다.
    if (!actualUser) {
        return <div>사용자 정보를 불러오는 중...</div>;
    }

    return (
        <div className="main-page-container">
            <header className="main-header">
                <div className="logo-area">
                    <div className="logo-box"/>
                    <h1>Daily Compass</h1>
                </div>
                <div className="user-area">
                    {/* user.nickname 대신 actualUser.nickname을 사용합니다. */}
                    <span>{actualUser.nickname} 님, 환영합니다!</span>
                    <button onClick={onLogout} className="logout-btn">logout</button>
                </div>
            </header>
            <main className="main-content">
                <div className="postbox-section">
                    <MindPostbox />
                </div>
                <div className="diary-section">
                    <h2>My Diary</h2>
                    {/* TodoList에는 실제 사용자 객체(actualUser)를 전달합니다. */}
                    <TodoList user={actualUser} />
                </div>
                <div className="news-section">
                     <NewsList />
                </div>
            </main>
        </div>
    );
};

export default MainPage;

