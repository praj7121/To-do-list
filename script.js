document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const globalAddBtn = document.getElementById('global-add-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskInput = document.getElementById('task-input');
    const categorySelect = document.getElementById('task-category');
    const deadlineInput = document.getElementById('task-deadline');
    const fullTaskList = document.getElementById('full-task-list');
    const dashboardTaskList = document.getElementById('dashboard-task-list');
    const navLinks = document.querySelectorAll('.nav-links li');
    const viewSections = document.querySelectorAll('.view-section');

    // Stats Elements
    const totalCountEl = document.getElementById('total-tasks-count');
    const completedCountEl = document.getElementById('completed-tasks-count');
    const pendingCountEl = document.getElementById('pending-tasks-count');
    const completionRateEl = document.getElementById('completion-rate');

    // Chart Instances
    let activityChartInstance = null;
    let categoryChartInstance = null;

    // --- State ---
    // --- State ---
    let currentUser = localStorage.getItem('zenith_current_user');
    let tasks = [];
    let currentFilter = 'all';
    let currentCalendarDate = new Date();

    // --- Initialization ---
    setupEventListeners();

    if (!currentUser) {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.classList.remove('hidden');
    } else {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.classList.add('hidden');
        loadData();
        initDashboard();
        renderTasks();
        updateStats();
        updateCharts();
        renderRecentTasks();
    }

    // --- Core Functions ---
    function initDashboard() {
        const date = new Date();
        document.getElementById('current-date-display').textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        // Random Quote
        const quotes = [
            "The secret of getting ahead is getting started.",
            "It always seems impossible until it's done.",
            "Focus on being productive instead of busy.",
            "Small progress is still progress."
        ];
        document.getElementById('daily-quote').textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
    }

    function setupEventListeners() {
        // Navigation
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const viewId = link.dataset.view;

                // Update UI
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                viewSections.forEach(section => {
                    section.classList.remove('active');
                    section.classList.add('hidden');
                });

                const activeSection = document.getElementById(`view-${viewId}`);
                if (activeSection) {
                    activeSection.classList.remove('hidden');
                    activeSection.classList.add('active');
                }

                // Refresh specific views
                if (viewId === 'dashboard') {
                    updateStats();
                    updateCharts(); // Render main dashboard charts
                    renderRecentTasks();
                } else if (viewId === 'calendar') {
                    renderCalendar(); // Explicitly render calendar when tab is opened
                } else if (viewId === 'analytics') {
                    // Re-render specific analytics charts if we were to have a separate page for them
                    // For now, the dashboard has the charts, but let's make sure they are updated if we have a view for them
                    updateCharts();
                }
            });
        });

        // Task Addition
        addTaskBtn.addEventListener('click', handleAddTask);
        globalAddBtn.addEventListener('click', () => {
            // Quick switch to tasks view and focus input
            const taskLink = document.querySelector('[data-view="tasks"]');
            if (taskLink) taskLink.click();
            taskInput.focus();
        });

        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddTask();
        });

        // Calendar Navigation (New IDs)
        // Calendar Navigation (New IDs)
        document.getElementById('prev-month-large')?.addEventListener('click', () => changeMonth(-1));
        document.getElementById('next-month-large')?.addEventListener('click', () => changeMonth(1));

        // Auth Logic
        const authBtn = document.getElementById('auth-login-btn');
        const authUser = document.getElementById('auth-username');

        if (authBtn) {
            authBtn.addEventListener('click', () => {
                const username = authUser.value.trim();
                if (username) {
                    currentUser = username;
                    localStorage.setItem('zenith_current_user', currentUser);
                    document.getElementById('auth-overlay').classList.add('hidden');

                    tasks = [];
                    loadData();
                    initDashboard();
                    renderTasks();
                    updateStats();
                    updateCharts();
                    renderRecentTasks();
                }
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Log out?')) {
                    localStorage.removeItem('zenith_current_user');
                    location.reload();
                }
            });
        }
    }

    function handleAddTask() {
        const text = taskInput.value.trim();
        const category = categorySelect.value;
        const dateVal = deadlineInput.value;

        if (!text) return;

        let deadline = dateVal ? new Date(dateVal).toISOString() : null;

        const newTask = {
            id: Date.now(),
            text: text,
            category: category,
            completed: false,
            createdAt: new Date().toISOString(),
            deadline: deadline
        };

        tasks.unshift(newTask);
        saveData();
        renderTasks(); // Refreshes full list
        updateStats();
        updateCharts();

        taskInput.value = '';
        deadlineInput.value = '';
    }

    function toggleTask(id) {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveData();
        renderTasks();
        updateStats();
        updateCharts();
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveData();
        renderTasks();
        updateStats();
        updateCharts();
    }

    // --- Calendar ---
    // Removed old modal open/close functions as we are using the full view now

    function changeMonth(delta) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
        renderCalendar();
    }

    function renderCalendar() {
        // Target the NEW large calendar elements
        const monthYearEl = document.getElementById('calendar-month-year-large');
        const calendarGridEl = document.getElementById('large-calendar-grid');

        if (!monthYearEl || !calendarGridEl) return;

        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();

        monthYearEl.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
        calendarGridEl.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty cells for previous month
        for (let i = 0; i < firstDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            calendarGridEl.appendChild(div);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.innerHTML = `<span>${i}</span>`;

            // Check if today
            const today = new Date();
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                div.classList.add('today');
            }

            // Check for tasks
            // We need to match precise dates safely
            const currentCellDate = new Date(year, month, i).toDateString();

            const dayTasks = tasks.filter(t => {
                if (!t.deadline || t.completed) return false;
                return new Date(t.deadline).toDateString() === currentCellDate;
            });

            if (dayTasks.length > 0) {
                // Show up to 2 dots or a count
                const dotsContainer = document.createElement('div');
                dotsContainer.className = 'calendar-dots';
                dayTasks.slice(0, 3).forEach(t => {
                    const dot = document.createElement('div');
                    dot.className = 'has-task-dot';
                    dot.title = t.text; // Tooltip
                    dotsContainer.appendChild(dot);
                });
                div.appendChild(dotsContainer);
            }

            calendarGridEl.appendChild(div);
        }
    }

    // --- Rendering ---
    function renderTasks() {
        renderList(fullTaskList, tasks);
        renderRecentTasks();
    }

    function renderRecentTasks() {
        const recent = tasks.slice(0, 5); // Show top 5
        renderList(dashboardTaskList, recent, true);
    }

    function renderList(container, taskData, isSimplified = false) {
        if (!container) return;
        container.innerHTML = '';

        taskData.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;

            const categoryTag = `<span class="task-category-tag">${task.category}</span>`;

            li.innerHTML = `
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                </div>
                <span class="task-text">${task.text}</span>
                ${!isSimplified ? categoryTag : ''}
                ${!isSimplified && task.deadline ? `<span class="task-date-badge">${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
                
                <button class="icon-btn delete-trigger">
                    <span class="material-icons-round">delete</span>
                </button>
            `;

            li.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(task.id));
            li.querySelector('.delete-trigger').addEventListener('click', () => deleteTask(task.id));

            container.appendChild(li);
        });
    }

    // --- Stats & Analytics ---
    function updateStats() {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

        totalCountEl.textContent = total;
        completedCountEl.textContent = completed;
        pendingCountEl.textContent = pending;
        completionRateEl.textContent = `${rate}%`;
    }

    function updateCharts() {
        // Dashboard Charts
        const ctxActivity = document.getElementById('activityChart')?.getContext('2d');
        const ctxCategory = document.getElementById('categoryChart')?.getContext('2d');

        // Analytics Page Charts
        const ctxAnalyticsActivity = document.getElementById('analyticsActivityChart')?.getContext('2d');
        const ctxAnalyticsCategory = document.getElementById('analyticsCategoryChart')?.getContext('2d');

        // Prepare Data
        const categories = {};
        tasks.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + 1;
        });
        const completedData = tasks.filter(t => t.completed).length;

        // Configuration (Reusable)
        const activityConfig = {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Tasks Completed',
                    data: [2, 4, 3, 5, completedData, 0, 0],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        };

        const categoryConfig = {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories).length ? Object.keys(categories) : ['None'],
                datasets: [{
                    data: Object.keys(categories).length ? Object.values(categories) : [1],
                    backgroundColor: ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        };

        // Render Dashboard Charts
        if (ctxActivity) {
            if (activityChartInstance) activityChartInstance.destroy();
            activityChartInstance = new Chart(ctxActivity, activityConfig);
        }
        if (ctxCategory) {
            if (categoryChartInstance) categoryChartInstance.destroy();
            categoryChartInstance = new Chart(ctxCategory, categoryConfig);
        }

        // Render Analytics Page Charts (New Instances)
        if (ctxAnalyticsActivity) {
            // We need separate instances or reuse logic. For simplicity, creating new ones.
            // Note: In a real app, track these instances to destroy them too.
            // Optimization: Only render if visible.
            new Chart(ctxAnalyticsActivity, activityConfig);
        }
        if (ctxAnalyticsCategory) {
            new Chart(ctxAnalyticsCategory, categoryConfig);
        }
    }

    function saveData() {
        if (!currentUser) return; // Don't save if not logged in
        localStorage.setItem(`zenith_tasks_${currentUser}`, JSON.stringify(tasks));
    }

    function loadData() {
        if (!currentUser) return;
        tasks = JSON.parse(localStorage.getItem(`zenith_tasks_${currentUser}`)) || [];
    }
});
