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
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentFilter = 'all';

    // --- Initialization ---
    initDashboard();
    renderTasks();
    updateStats();
    updateCharts();
    setupEventListeners();

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
                    updateCharts();
                    renderRecentTasks();
                }
            });
        });

        // Task Addition
        addTaskBtn.addEventListener('click', handleAddTask);
        globalAddBtn.addEventListener('click', () => {
            // Quick switch to tasks view and focus input
            document.querySelector('[data-view="tasks"]').click();
            taskInput.focus();
        });

        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddTask();
        });
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
        const ctxActivity = document.getElementById('activityChart').getContext('2d');
        const ctxCategory = document.getElementById('categoryChart').getContext('2d');

        // Prepare Data for Category Chart
        const categories = {};
        tasks.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + 1;
        });

        // Prepare Data for Activity Chart (Mock - just showing completed vs pending count)
        const completedData = tasks.filter(t => t.completed).length;
        const pendingData = tasks.filter(t => !t.completed).length;

        // Destroy old instances if they exist
        if (activityChartInstance) activityChartInstance.destroy();
        if (categoryChartInstance) categoryChartInstance.destroy();

        // 1. Weekly Activity (Bar Chart)
        activityChartInstance = new Chart(ctxActivity, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Tasks Completed',
                    data: [2, 4, 3, 5, completedData, 0, 0], // Mocking history for now + current
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
        });

        // 2. Category Distribution (Pie Chart)
        categoryChartInstance = new Chart(ctxCategory, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories),
                    backgroundColor: ['#60a5fa', '#34d399', '#f87171', '#fbbf24'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function saveData() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
});
