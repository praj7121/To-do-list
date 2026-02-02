document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskInput = document.getElementById('task-input');
    const taskDeadline = document.getElementById('task-deadline');
    const addBtn = document.getElementById('add-btn');
    const taskList = document.getElementById('task-list');
    const filterBtns = document.querySelectorAll('.filter-btn:not(#calendar-btn)');
    const emptyState = document.getElementById('empty-state');

    // Stats Elements
    const levelValue = document.getElementById('level-value');
    const streakValue = document.getElementById('streak-value');
    const xpBar = document.getElementById('xp-bar');
    const currentDayEl = document.getElementById('current-day');
    const currentDateEl = document.getElementById('current-date');

    // Voice & Focus & Calendar Elements
    const voiceBtn = document.getElementById('voice-btn');
    const focusOverlay = document.getElementById('focus-overlay');
    const closeFocusBtn = document.getElementById('close-focus-btn');
    const focusTaskText = document.getElementById('focus-task-text');
    const timerMinutes = document.getElementById('timer-minutes');
    const timerSeconds = document.getElementById('timer-seconds');
    const startTimerBtn = document.getElementById('start-timer-btn');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');
    const resetTimerBtn = document.getElementById('reset-timer-btn');

    const calendarBtn = document.getElementById('calendar-btn');
    const calendarModal = document.getElementById('calendar-modal');
    const closeCalendarBtn = document.getElementById('close-calendar');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // --- State ---
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let userStats = JSON.parse(localStorage.getItem('userStats')) || {
        xp: 0,
        level: 1,
        streak: 0,
        lastLoginDate: null
    };
    let currentFilter = 'all';
    let focusInterval;
    let timeLeft = 25 * 60;
    let isTimerRunning = false;
    let currentCalendarDate = new Date();

    // --- Initialization ---
    updateDate();
    checkStreak();
    renderTasks();
    updateStatsUI();
    requestNotificationPermission();
    setInterval(checkReminders, 60000); // Check reminders every minute

    // --- Event Listeners ---
    addBtn.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddTask();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    voiceBtn.addEventListener('click', startVoiceRecognition);

    // Focus Mode Listeners
    closeFocusBtn.addEventListener('click', closeFocusMode);
    startTimerBtn.addEventListener('click', startTimer);
    pauseTimerBtn.addEventListener('click', pauseTimer);
    resetTimerBtn.addEventListener('click', resetTimer);

    // Calendar Listeners
    calendarBtn.addEventListener('click', openCalendar);
    closeCalendarBtn.addEventListener('click', closeCalendar);
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));

    // --- Core Functions ---

    function handleAddTask() {
        const text = taskInput.value.trim();
        const dateVal = taskDeadline.value;

        if (!text) return;

        let deadline = null;
        if (dateVal) {
            deadline = new Date(dateVal).toISOString();
        } else {
            // Smart Parsing fallback
            if (text.toLowerCase().includes('tomorrow')) {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                d.setHours(9, 0, 0, 0); // Default to 9am
                deadline = d.toISOString();
            } else if (text.toLowerCase().includes('today')) {
                const d = new Date();
                d.setHours(18, 0, 0, 0); // Default to 6pm
                deadline = d.toISOString();
            }
        }

        const newTask = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString(),
            deadline: deadline,
            reminded: false
        };

        tasks.unshift(newTask);
        saveData();
        renderTasks();
        taskInput.value = '';
        taskDeadline.value = '';
    }

    function toggleTask(id) {
        tasks = tasks.map(task => {
            if (task.id === id) {
                const newState = !task.completed;
                if (newState) {
                    gainXP(10);
                }
                return { ...task, completed: newState };
            }
            return task;
        });
        saveData();
        renderTasks();
    }

    function deleteTask(id) {
        tasks = tasks.filter(task => task.id !== id);
        saveData();
        renderTasks();
    }

    function renderTasks() {
        taskList.innerHTML = '';

        const filteredTasks = tasks.filter(task => {
            if (currentFilter === 'active') return !task.completed;
            if (currentFilter === 'completed') return task.completed;
            return true;
        });

        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;

            let deadlineHtml = '';
            if (task.deadline) {
                const dateObj = new Date(task.deadline);
                const isOverdue = new Date() > dateObj && !task.completed;
                const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                deadlineHtml = `<span class="task-date-badge ${isOverdue ? 'overdue' : ''}">${formattedDate}</span>`;
            }

            li.innerHTML = `
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                </div>
                <div class="task-content">
                    <span class="task-text">${escapeHtml(task.text)} ${deadlineHtml}</span>
                    <div class="task-meta">
                         <!-- Meta info if needed -->
                    </div>
                </div>
                <div class="task-actions">
                    <button class="icon-btn small focus-trigger" title="Focus Mode">
                        <span class="material-icons-round">timer</span>
                    </button>
                    <button class="icon-btn small delete-trigger" title="Delete">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            `;

            const checkbox = li.querySelector('.task-checkbox');
            checkbox.addEventListener('change', () => toggleTask(task.id));

            const deleteBtn = li.querySelector('.delete-trigger');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTask(task.id);
            });

            const focusBtn = li.querySelector('.focus-trigger');
            focusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openFocusMode(task);
            });

            taskList.appendChild(li);
        });
    }

    // --- Gamification ---
    function gainXP(amount) {
        userStats.xp += amount;
        const newLevel = Math.floor(userStats.xp / 100) + 1;
        if (newLevel > userStats.level) {
            userStats.level = newLevel;
            alert(`Level Up! You are now Level ${newLevel} 🎉`);
        }
        saveData();
        updateStatsUI();
    }

    function updateStatsUI() {
        levelValue.textContent = userStats.level;
        streakValue.textContent = userStats.streak;
        const currentLevelXP = (userStats.level - 1) * 100;
        const nextLevelXP = userStats.level * 100;
        const progress = ((userStats.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
        xpBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    function checkStreak() {
        const today = new Date().toLocaleDateString();
        if (userStats.lastLoginDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (userStats.lastLoginDate === yesterday.toLocaleDateString()) {
                userStats.streak++;
            } else if (userStats.lastLoginDate !== today) {
                userStats.streak = 1;
            }
            userStats.lastLoginDate = today;
            saveData();
        }
    }

    // --- Voice Input ---
    function startVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Voice input not supported.');
            return;
        }
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.start();
        voiceBtn.classList.add('listening');

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            taskInput.value = transcript;
            voiceBtn.classList.remove('listening');
        };
        recognition.onerror = () => voiceBtn.classList.remove('listening');
        recognition.onend = () => voiceBtn.classList.remove('listening');
    }

    // --- Notifications ---
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }

    function checkReminders() {
        if (Notification.permission !== 'granted') return;

        const now = new Date();
        tasks.forEach(task => {
            if (task.deadline && !task.completed && !task.reminded) {
                const deadlineDate = new Date(task.deadline);
                // Trigger if within 1 minute of deadline, or overdue by less than 5 mins (to catch missed checks)
                const diff = (now - deadlineDate) / 1000 / 60;

                if (diff >= 0 && diff < 5) {
                    new Notification("Task Reminder 🔔", {
                        body: `Deadline reached: ${task.text}`,
                        icon: 'https://cdn-icons-png.flaticon.com/512/906/906334.png'
                    });
                    task.reminded = true;
                    saveData();
                }
            }
        });
    }

    // --- Calendar ---
    function openCalendar() {
        renderCalendar();
        calendarModal.classList.remove('hidden');
    }

    function closeCalendar() {
        calendarModal.classList.add('hidden');
    }

    function changeMonth(delta) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
        renderCalendar();
    }

    function renderCalendar() {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();

        calendarMonthYear.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
        calendarGrid.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty cells for previous month
        for (let i = 0; i < firstDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            calendarGrid.appendChild(div);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = i;

            // Check if today
            const today = new Date();
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                div.classList.add('today');
            }

            // Check for tasks
            const dateStr = new Date(year, month, i).toDateString(); // Compare dates locally
            const hasTask = tasks.some(t => {
                if (!t.deadline || t.completed) return false;
                return new Date(t.deadline).toDateString() === dateStr;
            });

            if (hasTask) {
                const dot = document.createElement('div');
                dot.className = 'has-task-dot';
                div.appendChild(dot);
            }

            calendarGrid.appendChild(div);
        }
    }

    // --- Focus Mode ---
    function openFocusMode(task) {
        focusTaskText.textContent = task.text;
        focusOverlay.classList.remove('hidden');
        resetTimer();
    }

    function closeFocusMode() {
        focusOverlay.classList.add('hidden');
        pauseTimer();
    }

    function startTimer() {
        if (isTimerRunning) return;
        isTimerRunning = true;
        startTimerBtn.classList.add('hidden');
        pauseTimerBtn.classList.remove('hidden');

        focusInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                completeFocusSession();
            }
        }, 1000);
    }

    function pauseTimer() {
        isTimerRunning = false;
        clearInterval(focusInterval);
        startTimerBtn.classList.remove('hidden');
        pauseTimerBtn.classList.add('hidden');
    }

    function resetTimer() {
        pauseTimer();
        timeLeft = 25 * 60;
        updateTimerDisplay();
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerMinutes.textContent = m < 10 ? '0' + m : m;
        timerSeconds.textContent = s < 10 ? '0' + s : s;
    }

    function completeFocusSession() {
        pauseTimer();
        alert('Focus Session Complete! +50 XP');
        gainXP(50);
        closeFocusMode();
    }

    // --- Helpers ---
    function saveData() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        localStorage.setItem('userStats', JSON.stringify(userStats));
    }

    function updateDate() {
        const date = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        currentDayEl.textContent = days[date.getDay()];
        currentDateEl.textContent = `${months[date.getMonth()]} ${date.getDate()}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
