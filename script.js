document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn');
    const taskList = document.getElementById('task-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const emptyState = document.getElementById('empty-state');
    
    // Stats Elements
    const levelValue = document.getElementById('level-value');
    const streakValue = document.getElementById('streak-value');
    const xpBar = document.getElementById('xp-bar');
    const currentDayEl = document.getElementById('current-day');
    const currentDateEl = document.getElementById('current-date');

    // Voice & Focus Elements
    const voiceBtn = document.getElementById('voice-btn');
    const focusOverlay = document.getElementById('focus-overlay');
    const closeFocusBtn = document.getElementById('close-focus-btn');
    const focusTaskText = document.getElementById('focus-task-text');
    const timerMinutes = document.getElementById('timer-minutes');
    const timerSeconds = document.getElementById('timer-seconds');
    const startTimerBtn = document.getElementById('start-timer-btn');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');
    const resetTimerBtn = document.getElementById('reset-timer-btn');

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

    // --- Initialization ---
    updateDate();
    checkStreak();
    renderTasks();
    updateStatsUI();

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

    // --- Core Functions ---

    function handleAddTask() {
        const text = taskInput.value.trim();
        if (!text) return;

        // Smart Parsing for Deadlines (Simple "tomorrow", "today" check)
        let deadline = null;
        if (text.toLowerCase().includes('tomorrow')) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            deadline = d.toLocaleDateString();
        } else if (text.toLowerCase().includes('today')) {
            deadline = new Date().toLocaleDateString();
        }

        const newTask = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString(),
            deadline: deadline
        };

        tasks.unshift(newTask);
        saveData();
        renderTasks();
        taskInput.value = '';
    }

    function toggleTask(id) {
        tasks = tasks.map(task => {
            if (task.id === id) {
                const newState = !task.completed;
                if (newState) {
                    gainXP(10); // 10 XP per task
                    triggerConfetti();
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
            
            li.innerHTML = `
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                </div>
                <div class="task-content">
                    <span class="task-text">${escapeHtml(task.text)}</span>
                    <div class="task-meta">
                        ${task.deadline ? `<span class="task-deadline">Due: ${task.deadline}</span>` : ''}
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

            // Event Delegation within Item
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
        
        // Simple Level Formula: Level = floor(DO / 100) + 1
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
        
        // Calculate progress to next level
        const currentLevelXP = (userStats.level - 1) * 100;
        const nextLevelXP = userStats.level * 100;
        const progress = ((userStats.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
        
        xpBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    function checkStreak() {
        const today = new Date().toLocaleDateString();
        
        if (userStats.lastLoginDate !== today) {
            // Check if login was yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (userStats.lastLoginDate === yesterday.toLocaleDateString()) {
                userStats.streak++;
            } else if (userStats.lastLoginDate !== today) { // Not today and not yesterday = broken streak
                userStats.streak = 1; // Reset to 1 (current day)
            }
            
            userStats.lastLoginDate = today;
            saveData();
        }
    }

    // --- Voice Input ---
    function startVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Voice input not supported in this browser.');
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
            handleAddTask(); // Auto-add? Or let user confirm? Let's auto-fill input then user sees.
            // Actually let's just fill it
        };

        recognition.onerror = () => {
            voiceBtn.classList.remove('listening');
        };
        
        recognition.onend = () => {
             voiceBtn.classList.remove('listening');
        };
    }

    // --- Focus Mode (Pomodoro) ---

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

    function triggerConfetti() {
        // Simple CSS-based confetti effect could be added here
        // For now, we rely on the task completion animation
    }
});
