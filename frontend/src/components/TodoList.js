import React, { useState, useEffect } from "react";

// --- 아이콘 SVG 컴포넌트 ---
const ChevronLeftIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> );
const ChevronRightIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg> );
const PlusIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> );
const TrashIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> );


const groupTodosByDate = (flatTodos) => {
    if (!flatTodos || !Array.isArray(flatTodos)) return {};
    return flatTodos.reduce((acc, todo) => {
        const dateKey = todo.date;
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(todo);
        return acc;
    }, {});
};

const getDevHeaders = (user) => {
    const headers = { 'Content-Type': 'application/json' };
    if (window.location.hostname === 'localhost' && user?.nickname) {
        // [수정] 한글 등 다국어 닉네임을 안전하게 전송하기 위해 인코딩합니다.
        headers['x-dev-user-id'] = encodeURIComponent(user.nickname);
    }
    return headers;
};


function TodoCalendar({ user }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [todos, setTodos] = useState({});
    const [newTodoText, setNewTodoText] = useState("");
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user && user.nickname) {
            const fetchTodos = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const response = await fetch('/api/todos', {
                        headers: getDevHeaders(user)
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`데이터 로딩 실패: ${errorText}`);
                    }
                    const flatTodos = await response.json();
                    const groupedTodos = groupTodosByDate(flatTodos);
                    setTodos(groupedTodos);
                } catch (err) {
                    showErrorWithTimeout(err.message);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchTodos();
        } else {
            setTodos({});
        }
    }, [user]);

    const showErrorWithTimeout = (message) => {
        setError(message);
        setTimeout(() => setError(null), 3000);
    };

    const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1, 두 자리로 포맷팅
    const day = String(date.getDate()).padStart(2, '0');    // 두 자리로 포맷팅
    return `${year}-${month}-${day}`;
};

    const handleAddTodo = async (e) => {
        e.preventDefault();
        const text = newTodoText.trim();
        if (text === "") return showErrorWithTimeout("할 일 내용을 입력해주세요.");
        const dateKey = formatDateKey(selectedDate);
        const newTodoData = { text, date: dateKey };

        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: getDevHeaders(user),
                body: JSON.stringify(newTodoData),
            });
            if (!response.ok) throw new Error('추가 실패');
            const createdTodo = await response.json();
            const updatedTodosForDate = todos[dateKey] ? [...todos[dateKey], createdTodo] : [createdTodo];
            setTodos({ ...todos, [dateKey]: updatedTodosForDate });
            setNewTodoText("");
        } catch (err) {
            showErrorWithTimeout("할 일 추가 중 오류가 발생했습니다.");
        }
    };

    const handleToggleTodo = async (todoId, currentCompleted) => {
        const dateKey = formatDateKey(selectedDate);
        const newCompleted = !currentCompleted;

        try {
            const response = await fetch(`/api/todos/${todoId}`, {
                method: 'PUT',
                headers: getDevHeaders(user),
                body: JSON.stringify({ completed: newCompleted })
            });
            if (!response.ok) throw new Error('업데이트 실패');
            const updatedTodosForDate = todos[dateKey].map(todo =>
                todo._id === todoId ? { ...todo, completed: newCompleted } : todo
            );
            setTodos({ ...todos, [dateKey]: updatedTodosForDate });
        } catch (err) {
            showErrorWithTimeout("업데이트 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteTodo = async (todoId) => {
        const dateKey = formatDateKey(selectedDate);

        try {
            const response = await fetch(`/api/todos/${todoId}`, {
                method: 'DELETE',
                headers: getDevHeaders(user)
            });
            if (!response.ok) throw new Error('삭제 실패');
            const updatedTodosForDate = todos[dateKey].filter(todo => todo._id !== todoId);
            const updatedTodos = { ...todos };
            if (updatedTodosForDate.length === 0) {
                delete updatedTodos[dateKey];
            } else {
                updatedTodos[dateKey] = updatedTodosForDate;
            }
            setTodos(updatedTodos);
        } catch (err) {
            showErrorWithTimeout("삭제 중 오류가 발생했습니다.");
        }
    };

    const renderCalendarDates = () => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
        const endDate = new Date(lastDayOfMonth);
        endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()));
        const dates = [];
        let dateIterator = new Date(startDate);
        while (dateIterator <= endDate) {
            dates.push(new Date(dateIterator));
            dateIterator.setDate(dateIterator.getDate() + 1);
        }
        return dates.map((date, index) => {
            const dateKey = formatDateKey(date);
            const isCurrentMonth = date.getMonth() === month;
            const isSelected = formatDateKey(selectedDate) === dateKey;
            const isToday = formatDateKey(new Date()) === dateKey;
            const hasTodos = todos[dateKey] && todos[dateKey].length > 0;
            const cellClasses = `day-cell ${isCurrentMonth ? '' : 'not-current-month'} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`;
            return (
                <div key={index} className={cellClasses} onClick={() => setSelectedDate(date)}>
                    <span>{date.getDate()}</span>
                    {hasTodos && <div className="todo-dot"></div>}
                </div>
            );
        });
    };

    const todosForSelectedDate = todos[formatDateKey(selectedDate)] || [];

    return (
        <div className="diary-layout-container">
            <div className="todo-list-container">
                <h3 className="todo-header">{selectedDate.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</h3>
                <form onSubmit={handleAddTodo} className="todo-form">
                    <input type="text" className="todo-input" placeholder="새로운 할 일을 추가하세요" value={newTodoText} onChange={(e) => setNewTodoText(e.target.value)} />
                    <button type="submit" className="add-btn"><PlusIcon /></button>
                </form>
                {error && <div className="error-message inline-error">{error}</div>}
                {isLoading ? (
                    <div className="loading-spinner"><p>로딩 중...</p></div>
                ) : (
                    <ul className="todo-list">
                        {todosForSelectedDate.length > 0 ? (
                            todosForSelectedDate.map(todo => (
                                <li key={todo._id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                                    <div className="todo-content" onClick={() => handleToggleTodo(todo._id, todo.completed)}>
                                        <span className="custom-checkbox">{todo.completed && '✔'}</span>
                                        <span className="todo-text">{todo.text}</span>
                                    </div>
                                    <button className="delete-btn" onClick={() => handleDeleteTodo(todo._id)}><TrashIcon /></button>
                                </li>
                            ))
                        ) : (
                            <div className="no-todos"><p>할 일이 없습니다. <br />새로운 계획을 추가해보세요!</p></div>
                        )}
                    </ul>
                )}
            </div>
            <div className="calendar-container">
                <div className="calendar-header">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="nav-btn"><ChevronLeftIcon /></button>
                    <h2>{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="nav-btn"><ChevronRightIcon /></button>
                </div>
                <div className="calendar-days">{['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} className="day-name">{d}</div>)}</div>
                <div className="calendar-grid">{renderCalendarDates()}</div>
            </div>
        </div>
    );
}

export default TodoCalendar;

