/**
 * TASKFLOW — SMART PROJECT MANAGEMENT TOOL
 * Pure Vanilla JavaScript Application Architecture
 * Persistent Local Storage via HTML5 IndexedDB API
 */

// ==========================================================================
// 1. Database Layer (IndexedDB Wrapper with Promise APIs)
// ==========================================================================
const DB_NAME = 'TaskFlowDB';
const DB_VERSION = 1;

class TaskFlowDB {
  constructor() {
    this.db = null;
    this.isReady = false;
  }

  /**
   * Initializes the IndexedDB database and creates object stores and indexes.
   */
  async init() {
    if (!('indexedDB' in window)) {
      throw new Error('IndexedDB is not supported in this browser. Please use a modern browser.');
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store 1: Projects
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('title', 'title', { unique: false });
          projectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Store 2: Tasks
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('projectId', 'projectId', { unique: false });
          taskStore.createIndex('status', 'status', { unique: false });
          taskStore.createIndex('priority', 'priority', { unique: false });
          taskStore.createIndex('assignedTo', 'assignedTo', { unique: false });
          taskStore.createIndex('dueDate', 'dueDate', { unique: false });
        }

        // Store 3: Team Members
        if (!db.objectStoreNames.contains('members')) {
          const memberStore = db.createObjectStore('members', { keyPath: 'id' });
          memberStore.createIndex('email', 'email', { unique: true });
          memberStore.createIndex('name', 'name', { unique: false });
        }

        // Store 4: Comments
        if (!db.objectStoreNames.contains('comments')) {
          const commentStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentStore.createIndex('taskId', 'taskId', { unique: false });
          commentStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Store 5: Settings / User Preferences
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;

        // Global DB error handler
        this.db.onerror = (e) => {
          console.error('IndexedDB Error:', e.target.error);
        };

        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked. Please close other open tabs of this app.');
      };
    });
  }

  /**
   * Helper to perform a store transaction.
   */
  _tx(storeName, mode = 'readonly') {
    if (!this.db) {
      throw new Error('Database is not initialized yet.');
    }
    const tx = this.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { tx, store };
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx(storeName, 'readonly');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getById(storeName, id) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx(storeName, 'readonly');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async add(storeName, item) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx(storeName, 'readwrite');
        const req = store.add(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async update(storeName, item) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx(storeName, 'readwrite');
        const req = store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx(storeName, 'readwrite');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async clearStore(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx(storeName, 'readwrite');
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getCommentsByTaskId(taskId) {
    return new Promise((resolve, reject) => {
      try {
        const { store } = this._tx('comments', 'readonly');
        const index = store.index('taskId');
        const req = index.getAll(taskId);
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteProjectCascading(projectId) {
    // 1. Fetch tasks related to this project
    const allTasks = await this.getAll('tasks');
    const tasksToDelete = allTasks.filter(t => t.projectId === projectId);

    // 2. Delete tasks and their comments
    for (const t of tasksToDelete) {
      await this.deleteTaskCascading(t.id);
    }

    // 3. Delete the project record
    return await this.delete('projects', projectId);
  }

  async deleteTaskCascading(taskId) {
    // 1. Delete all comments associated with this task
    const comments = await this.getCommentsByTaskId(taskId);
    for (const c of comments) {
      await this.delete('comments', c.id);
    }
    // 2. Delete task
    return await this.delete('tasks', taskId);
  }

  async getSetting(key, defaultValue = null) {
    const item = await this.getById('settings', key);
    return item ? item.value : defaultValue;
  }

  async setSetting(key, value) {
    return await this.update('settings', { key, value });
  }

  async clearAll() {
    await this.clearStore('projects');
    await this.clearStore('tasks');
    await this.clearStore('members');
    await this.clearStore('comments');
  }
}

const db = new TaskFlowDB();

// ==========================================================================
// 2. Application State & Context
// ==========================================================================
const AppState = {
  currentView: 'dashboard',
  taskViewMode: 'kanban', // 'kanban' | 'list'
  projects: [],
  tasks: [],
  members: [],
  comments: [],
  settings: {
    displayName: 'Project Lead',
    userRole: 'Full Stack Demo Lead',
    theme: 'light'
  },
  filters: {
    taskSearch: '',
    taskProject: 'all',
    taskPriority: 'all',
    taskAssignee: 'all',
    taskStatus: 'all',
    projectSearch: '',
    projectSort: 'newest',
    memberSearch: ''
  },
  activeModal: null,
  currentlyViewingTaskId: null,
  currentlyViewingProjectId: null
};

// ==========================================================================
// 3. Utility Helpers
// ==========================================================================
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'No deadline';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(dateStr, status) {
  if (!dateStr || status === 'Completed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return due < today;
}

function getDaysRemaining(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toast notification helper
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '✕';

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.6rem;">
      <span style="font-weight:800;">${icon}</span>
      <span>${escapeHTML(message)}</span>
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  };

  closeBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  setTimeout(dismiss, duration);
}

// ==========================================================================
// 4. Sample Demo Dataset Generator
// ==========================================================================
async function loadRealisticSampleData() {
  // 1. Members
  const sampleMembers = [
    {
      id: 'mem_1',
      name: 'Sophia Carter',
      email: 'sophia.carter@taskflow.demo',
      role: 'Project Lead & Architect',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem_2',
      name: 'Liam Evans',
      email: 'liam.evans@taskflow.demo',
      role: 'Senior Frontend Engineer',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem_3',
      name: 'Elena Rostova',
      email: 'elena.rostova@taskflow.demo',
      role: 'Lead UI/UX Designer',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem_4',
      name: 'Marcus Chen',
      email: 'marcus.chen@taskflow.demo',
      role: 'DevOps & Cloud Engineer',
      createdAt: new Date().toISOString()
    }
  ];

  // 2. Projects
  const today = new Date();
  const dateOffset = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const sampleProjects = [
    {
      id: 'proj_1',
      title: 'E-Commerce Platform Redesign',
      description: 'Comprehensive UI overhaul with modern component design system, cart optimization, and mobile responsive checkouts.',
      owner: 'Sophia Carter',
      members: ['mem_1', 'mem_2', 'mem_3'],
      dueDate: dateOffset(14),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
    },
    {
      id: 'proj_2',
      title: 'Cloud Infrastructure & CI/CD Migration',
      description: 'Automated continuous integration pipeline, Docker containerization, and zero-downtime static site deployment configuration.',
      owner: 'Marcus Chen',
      members: ['mem_1', 'mem_4'],
      dueDate: dateOffset(7),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString()
    },
    {
      id: 'proj_3',
      title: 'AI Smart Search Engine Integration',
      description: 'Real-time client-side indexing and contextual query filter parser for instant product catalogue navigation.',
      owner: 'Liam Evans',
      members: ['mem_2', 'mem_3'],
      dueDate: dateOffset(-2), // Intentionally overdue for deadline demo!
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString()
    }
  ];

  // 3. Tasks
  const sampleTasks = [
    {
      id: 'task_1',
      title: 'Audit User Flow and Wireframe Figma Prototypes',
      description: 'Review existing checkout bottlenecks and propose a streamlined 3-step checkout experience with accessible form controls.',
      projectId: 'proj_1',
      assignedTo: 'mem_3',
      priority: 'High',
      status: 'Completed',
      dueDate: dateOffset(-4),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString()
    },
    {
      id: 'task_2',
      title: 'Implement Responsive Navigation and Dark Theme Tokens',
      description: 'Build collapsible sidebar with SVG iconography and establish CSS custom properties for seamless theme toggling.',
      projectId: 'proj_1',
      assignedTo: 'mem_2',
      priority: 'High',
      status: 'In Progress',
      dueDate: dateOffset(3),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
    },
    {
      id: 'task_3',
      title: 'Design Empty States & Accessibility Labels',
      description: 'Ensure all buttons, modals, and input controls meet WCAG AA standards with proper ARIA attributes.',
      projectId: 'proj_1',
      assignedTo: 'mem_3',
      priority: 'Medium',
      status: 'To Do',
      dueDate: dateOffset(8),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()
    },
    {
      id: 'task_4',
      title: 'Configure GitHub Pages Deployment Workflow',
      description: 'Setup clean static hosting with zero external dependencies and ensure relative paths work on repository subpaths.',
      projectId: 'proj_2',
      assignedTo: 'mem_4',
      priority: 'Medium',
      status: 'Completed',
      dueDate: dateOffset(-1),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
    },
    {
      id: 'task_5',
      title: 'Implement Database Connection Retry Logic',
      description: 'Provide graceful user notifications and fallback handling if browser storage permissions are blocked.',
      projectId: 'proj_2',
      assignedTo: 'mem_1',
      priority: 'High',
      status: 'In Progress',
      dueDate: dateOffset(2),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()
    },
    {
      id: 'task_6',
      title: 'Benchmark Fuzzy Search Indexing Latency',
      description: 'Test search response time over 1,000 sample records to ensure non-blocking 60fps main thread performance.',
      projectId: 'proj_3',
      assignedTo: 'mem_2',
      priority: 'High',
      status: 'To Do',
      dueDate: dateOffset(-2), // Overdue!
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString()
    },
    {
      id: 'task_7',
      title: 'Prepare Internship Documentation & Architecture Guide',
      description: 'Document database entity relationships, drag-and-drop event pipeline, and beginner GitHub upload instructions.',
      projectId: 'proj_3',
      assignedTo: 'mem_1',
      priority: 'Low',
      status: 'To Do',
      dueDate: dateOffset(5),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString()
    }
  ];

  // 4. Comments
  const sampleComments = [
    {
      id: 'comm_1',
      taskId: 'task_2',
      author: 'Sophia Carter',
      content: 'The CSS variable structure looks super clean! Please remember to test high-contrast readability in dark slate mode.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
    },
    {
      id: 'comm_2',
      taskId: 'task_2',
      author: 'Liam Evans',
      content: 'Tested and verified. The contrast ratio passes WCAG AAA with the new indigo and purple accents.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
    },
    {
      id: 'comm_3',
      taskId: 'task_6',
      author: 'Liam Evans',
      content: 'We need to profile the query debounce threshold on lower-end mobile devices before closing this milestone.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString()
    }
  ];

  // Save to DB
  for (const m of sampleMembers) await db.update('members', m);
  for (const p of sampleProjects) await db.update('projects', p);
  for (const t of sampleTasks) await db.update('tasks', t);
  for (const c of sampleComments) await db.update('comments', c);

  await loadAllDataFromDB();
}

// ==========================================================================
// 5. Data Synchronization & Cache Loader
// ==========================================================================
async function loadAllDataFromDB() {
  try {
    AppState.projects = await db.getAll('projects');
    AppState.tasks = await db.getAll('tasks');
    AppState.members = await db.getAll('members');
    AppState.comments = await db.getAll('comments');

    // Load saved settings
    const savedName = await db.getSetting('displayName', 'Project Lead');
    const savedRole = await db.getSetting('userRole', 'Full Stack Demo Lead');
    const savedTheme = await db.getSetting('theme', 'light');

    AppState.settings = {
      displayName: savedName,
      userRole: savedRole,
      theme: savedTheme
    };

    applyTheme(savedTheme);
    updateUserProfileDisplay();
    updateSidebarBadges();
    refreshCurrentView();
    updateNotificationsBadge();
  } catch (err) {
    console.error('Failed to sync data from IndexedDB:', err);
    showToast('Failed to load local data from browser storage.', 'error');
  }
}

function updateSidebarBadges() {
  const pCount = document.getElementById('navProjectCount');
  const tCount = document.getElementById('navTaskCount');
  const mCount = document.getElementById('navMemberCount');

  if (pCount) pCount.textContent = AppState.projects.length;
  if (tCount) tCount.textContent = AppState.tasks.length;
  if (mCount) mCount.textContent = AppState.members.length;
}

function updateUserProfileDisplay() {
  const topName = document.getElementById('topUserName');
  const topAvatar = document.getElementById('topUserAvatar');
  const dropName = document.getElementById('profileDropdownName');
  const inputName = document.getElementById('settingsDisplayName');
  const inputRole = document.getElementById('settingsUserRole');

  const name = AppState.settings.displayName || 'Project Lead';
  if (topName) topName.textContent = name;
  if (dropName) dropName.textContent = name;
  if (topAvatar) topAvatar.textContent = getInitials(name);
  if (inputName) inputName.value = name;
  if (inputRole) inputRole.value = AppState.settings.userRole || '';
}

function applyTheme(theme) {
  AppState.settings.theme = theme;
  document.body.setAttribute('data-theme', theme);

  const iconSun = document.getElementById('themeIconSun');
  const iconMoon = document.getElementById('themeIconMoon');
  const radioLight = document.getElementById('themeRadioLight');
  const radioDark = document.getElementById('themeRadioDark');

  if (theme === 'dark') {
    if (iconSun) iconSun.classList.remove('hidden');
    if (iconMoon) iconMoon.classList.add('hidden');
    if (radioDark) radioDark.checked = true;
  } else {
    if (iconSun) iconSun.classList.add('hidden');
    if (iconMoon) iconMoon.classList.remove('hidden');
    if (radioLight) radioLight.checked = true;
  }
}

// ==========================================================================
// 6. Navigation & Routing
// ==========================================================================
function navigateTo(viewName) {
  AppState.currentView = viewName;

  // Update nav buttons
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `view-${viewName}`);
  });

  // Update topbar breadcrumbs
  const breadcrumb = document.getElementById('breadcrumbTitle');
  const titles = {
    dashboard: 'Dashboard',
    projects: 'My Projects',
    tasks: 'My Tasks & Kanban',
    team: 'Team Directory',
    settings: 'Settings & Storage'
  };
  if (breadcrumb) breadcrumb.textContent = titles[viewName] || 'Dashboard';

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Render view content
  refreshCurrentView();
}

function refreshCurrentView() {
  switch (AppState.currentView) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'projects':
      renderProjects();
      break;
    case 'tasks':
      renderTasks();
      break;
    case 'team':
      renderTeam();
      break;
    case 'settings':
      renderSettings();
      break;
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

// ==========================================================================
// 7. DASHBOARD VIEW RENDERING & METRICS
// ==========================================================================
function renderDashboard() {
  const { projects, tasks, members } = AppState;

  // Empty state handling
  const emptyCard = document.getElementById('dashboardEmptyState');
  const statsGrid = document.getElementById('dashboardStatsGrid');

  if (projects.length === 0 && tasks.length === 0) {
    if (emptyCard) emptyCard.classList.remove('hidden');
  } else {
    if (emptyCard) emptyCard.classList.add('hidden');
  }

  // 1. Calculations
  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const pendingTasks = tasks.filter(t => t.status === 'To Do').length;

  const overdueTasks = tasks.filter(t => isOverdue(t.dueDate, t.status));
  const upcomingTasks = tasks.filter(t => {
    if (!t.dueDate || t.status === 'Completed') return false;
    const days = getDaysRemaining(t.dueDate);
    return days !== null && days >= 0 && days <= 7;
  });

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 2. Populate Stat Cards
  const elTotalProjects = document.getElementById('statTotalProjects');
  const elTotalTasks = document.getElementById('statTotalTasks');
  const elCompleted = document.getElementById('statCompletedTasks');
  const elInProgress = document.getElementById('statInProgressTasks');
  const elPending = document.getElementById('statPendingTasks');
  const elDeadlines = document.getElementById('statUpcomingDeadlines');
  const elCompletionRate = document.getElementById('statCompletionRate');
  const elOverdueWarning = document.getElementById('statOverdueWarning');

  if (elTotalProjects) elTotalProjects.textContent = totalProjects;
  if (elTotalTasks) elTotalTasks.textContent = totalTasks;
  if (elCompleted) elCompleted.textContent = completedTasks;
  if (elInProgress) elInProgress.textContent = inProgressTasks;
  if (elPending) elPending.textContent = pendingTasks;
  if (elDeadlines) elDeadlines.textContent = upcomingTasks.length + overdueTasks.length;
  if (elCompletionRate) elCompletionRate.textContent = `${completionRate}% Overall completion`;

  if (elOverdueWarning) {
    if (overdueTasks.length > 0) {
      elOverdueWarning.innerHTML = `<span class="text-danger font-bold">⚠️ ${overdueTasks.length} overdue</span> · ${upcomingTasks.length} upcoming`;
    } else {
      elOverdueWarning.textContent = `${upcomingTasks.length} due within 7 days`;
    }
  }

  // 3. Project Progress Overview List
  const progressListEl = document.getElementById('dashProjectProgressList');
  if (progressListEl) {
    if (projects.length === 0) {
      progressListEl.innerHTML = `<p class="text-sm text-muted">No projects created yet. Click "Create Project" above to get started.</p>`;
    } else {
      progressListEl.innerHTML = projects.slice(0, 5).map(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const pTotal = projectTasks.length;
        const pCompleted = projectTasks.filter(t => t.status === 'Completed').length;
        const pPercent = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;

        return `
          <div class="project-progress-item">
            <div class="flex-between">
              <div>
                <a href="#projects" class="font-bold text-sm" onclick="openProjectDetailsModal('${project.id}')" style="cursor:pointer;color:var(--text-main);">${escapeHTML(project.title)}</a>
                <span class="text-xs text-muted" style="display:block;">Lead: ${escapeHTML(project.owner)}</span>
              </div>
              <div class="text-right">
                <span class="font-bold text-sm ${pPercent === 100 ? 'text-success' : ''}">${pPercent}%</span>
                <span class="text-xs text-muted" style="display:block;">${pCompleted}/${pTotal} tasks</span>
              </div>
            </div>
            <div class="progress-track">
              <div class="progress-bar-fill ${pPercent === 100 ? 'complete' : ''}" style="width: ${pPercent}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Recent Tasks Activity Table
  const recentTable = document.getElementById('dashRecentTasksTable');
  if (recentTable) {
    if (tasks.length === 0) {
      recentTable.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem;">No task activity recorded yet.</td></tr>`;
    } else {
      const sortedTasks = [...tasks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6);
      recentTable.innerHTML = sortedTasks.map(t => {
        const proj = projects.find(p => p.id === t.projectId);
        const member = members.find(m => m.id === t.assignedTo);
        const assigneeName = member ? member.name : (t.assignedTo || 'Unassigned');
        const overdue = isOverdue(t.dueDate, t.status);

        return `
          <tr style="cursor:pointer;" onclick="openTaskDetailsModal('${t.id}')">
            <td>
              <div class="font-semibold text-sm">${escapeHTML(t.title)}</div>
            </td>
            <td>
              <span class="text-xs text-muted">${escapeHTML(proj ? proj.title : 'General')}</span>
            </td>
            <td>
              <div class="flex-center gap-2">
                <div class="user-avatar avatar-sm">${getInitials(assigneeName)}</div>
                <span class="text-xs">${escapeHTML(assigneeName)}</span>
              </div>
            </td>
            <td>
              <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
            </td>
            <td>
              <span class="badge badge-${t.status.toLowerCase().replace(' ', '')}">${t.status}</span>
            </td>
            <td>
              <span class="text-xs ${overdue ? 'text-danger font-bold' : 'text-muted'}">
                ${overdue ? '⚠️ ' : ''}${formatDate(t.dueDate)}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 5. Deadlines Watch List
  const deadlinesListEl = document.getElementById('dashDeadlinesList');
  if (deadlinesListEl) {
    const urgentTasks = [...overdueTasks, ...upcomingTasks]
      .filter((t, index, self) => self.findIndex(item => item.id === t.id) === index)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);

    if (urgentTasks.length === 0) {
      deadlinesListEl.innerHTML = `<p class="text-sm text-muted">All deadlines are comfortably in the clear! 🎉</p>`;
    } else {
      deadlinesListEl.innerHTML = urgentTasks.map(t => {
        const overdue = isOverdue(t.dueDate, t.status);
        const daysLeft = getDaysRemaining(t.dueDate);
        let badgeText = `${daysLeft} days left`;
        if (overdue) {
          badgeText = `Overdue (${Math.abs(daysLeft)}d)`;
        } else if (daysLeft === 0) {
          badgeText = `Due Today!`;
        } else if (daysLeft === 1) {
          badgeText = `Due Tomorrow`;
        }

        return `
          <div class="deadline-card" style="cursor:pointer;" onclick="openTaskDetailsModal('${t.id}')">
            <div>
              <div class="deadline-title">${escapeHTML(t.title)}</div>
              <div class="deadline-sub">${formatDate(t.dueDate)} · Priority: ${t.priority}</div>
            </div>
            <span class="deadline-badge ${overdue ? 'text-danger' : 'text-amber'}">${badgeText}</span>
          </div>
        `;
      }).join('');
    }
  }

  // 6. Mini Team Roster
  const teamMiniEl = document.getElementById('dashTeamMiniList');
  if (teamMiniEl) {
    if (members.length === 0) {
      teamMiniEl.innerHTML = `<p class="text-sm text-muted">No team members registered. Add members to assign tasks.</p>`;
    } else {
      teamMiniEl.innerHTML = members.slice(0, 4).map(m => {
        const assignedCount = tasks.filter(t => t.assignedTo === m.id || t.assignedTo === m.name).length;
        return `
          <div class="team-mini-item">
            <div class="flex-center gap-2">
              <div class="user-avatar avatar-sm">${getInitials(m.name)}</div>
              <div>
                <span class="font-semibold text-xs" style="display:block;">${escapeHTML(m.name)}</span>
                <span class="text-xs text-muted">${escapeHTML(m.role)}</span>
              </div>
            </div>
            <span class="badge badge-primary text-xs">${assignedCount} tasks</span>
          </div>
        `;
      }).join('');
    }
  }
}

// ==========================================================================
// 8. PROJECT MANAGEMENT CRUD & RENDERING
// ==========================================================================
function renderProjects() {
  const { projects, tasks, members, filters } = AppState;
  const grid = document.getElementById('projectsGrid');
  const emptyState = document.getElementById('projectsEmptyState');
  const emptyMsg = document.getElementById('projectsEmptyMsg');

  // Filter & Search
  let filtered = [...projects];

  if (filters.projectSearch.trim()) {
    const q = filters.projectSearch.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.owner.toLowerCase().includes(q)
    );
  }

  // Sorting
  filtered.sort((a, b) => {
    if (filters.projectSort === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    if (filters.projectSort === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (filters.projectSort === 'progress') {
      const getP = (proj) => {
        const pTasks = tasks.filter(t => t.projectId === proj.id);
        if (pTasks.length === 0) return 0;
        return pTasks.filter(t => t.status === 'Completed').length / pTasks.length;
      };
      return getP(b) - getP(a);
    }
    // Default newest
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  if (filtered.length === 0) {
    if (grid) grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (emptyMsg) {
      emptyMsg.textContent = filters.projectSearch.trim()
        ? 'No projects matched your search criteria.'
        : 'Get started by creating your first project.';
    }
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (grid) {
    grid.innerHTML = filtered.map(p => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      const total = pTasks.length;
      const completed = pTasks.filter(t => t.status === 'Completed').length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Project Assigned Members
      const assignedMembers = (p.members || []).map(mid => members.find(m => m.id === mid)).filter(Boolean);

      return `
        <div class="project-card" data-project-id="${p.id}">
          <div class="project-card-header">
            <div>
              <span class="badge badge-primary mb-1">Lead: ${escapeHTML(p.owner)}</span>
              <h3 class="project-card-title">${escapeHTML(p.title)}</h3>
            </div>
            <button class="icon-btn-sm" onclick="openProjectDetailsModal('${p.id}')" title="View Project Details">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
          </div>

          <p class="project-card-desc">${escapeHTML(p.description)}</p>

          <div class="project-card-meta">
            <!-- Progress Section -->
            <div>
              <div class="flex-between text-xs mb-1">
                <span class="font-semibold text-muted">Completion Rate</span>
                <span class="font-bold ${percent === 100 ? 'text-success' : 'text-indigo'}">${percent}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar-fill ${percent === 100 ? 'complete' : ''}" style="width: ${percent}%;"></div>
              </div>
            </div>

            <div class="project-meta-row">
              <span class="text-xs text-muted">
                <strong>${total}</strong> total tasks (${completed} done)
              </span>
              <span class="text-xs text-muted">
                Due: ${formatDate(p.dueDate)}
              </span>
            </div>

            <!-- Member Avatars -->
            <div class="flex-between">
              <div class="avatar-chips-group">
                ${assignedMembers.slice(0, 3).map(m => `
                  <div class="avatar-chip" title="${escapeHTML(m.name)} (${escapeHTML(m.role)})">
                    <div class="user-avatar avatar-sm">${getInitials(m.name)}</div>
                    <span>${escapeHTML(m.name.split(' ')[0])}</span>
                  </div>
                `).join('')}
                ${assignedMembers.length > 3 ? `<span class="text-xs text-muted">+${assignedMembers.length - 3}</span>` : ''}
                ${assignedMembers.length === 0 ? `<span class="text-xs text-muted">No members assigned</span>` : ''}
              </div>
            </div>

            <!-- Actions Bar -->
            <div class="project-card-actions">
              <button class="btn btn-sm btn-ghost" onclick="openProjectDetailsModal('${p.id}')">View Details</button>
              <div class="flex-center gap-2">
                <button class="btn btn-sm btn-outline" onclick="openEditProjectModal('${p.id}')" title="Edit project">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="promptDeleteProject('${p.id}', '${escapeHTML(p.title)}')" title="Delete project">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Modal: Open Create / Edit Project
function openCreateProjectModal() {
  AppState.currentlyEditingProjectId = null;
  const modal = document.getElementById('projectModal');
  const form = document.getElementById('projectForm');
  const title = document.getElementById('projectModalTitle');

  if (form) form.reset();
  document.getElementById('projectIdInput').value = '';
  if (title) title.textContent = 'Create New Project';

  populateProjectMembersChecklist([]);
  clearFormErrors('project');
  openModal('projectModal');
}

function openEditProjectModal(projectId) {
  const project = AppState.projects.find(p => p.id === projectId);
  if (!project) return;

  AppState.currentlyEditingProjectId = projectId;
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('projectModalTitle');

  if (title) title.textContent = 'Edit Project';

  document.getElementById('projectIdInput').value = project.id;
  document.getElementById('projectTitleInput').value = project.title;
  document.getElementById('projectDescInput').value = project.description;
  document.getElementById('projectOwnerInput').value = project.owner;
  document.getElementById('projectDueDateInput').value = project.dueDate || '';

  populateProjectMembersChecklist(project.members || []);
  clearFormErrors('project');
  openModal('projectModal');
}

function populateProjectMembersChecklist(selectedMemberIds = []) {
  const container = document.getElementById('projectMembersCheckboxList');
  if (!container) return;

  if (AppState.members.length === 0) {
    container.innerHTML = `<span class="text-xs text-muted" style="padding:0.5rem;">No team members registered yet. You can add them in the Team section.</span>`;
    return;
  }

  container.innerHTML = AppState.members.map(m => {
    const isChecked = selectedMemberIds.includes(m.id);
    return `
      <label class="checkbox-label">
        <input type="checkbox" name="projectMember" value="${m.id}" ${isChecked ? 'checked' : ''}>
        <span>${escapeHTML(m.name)}</span>
      </label>
    `;
  }).join('');
}

// Save Project (Create / Update)
async function handleProjectFormSubmit(e) {
  e.preventDefault();
  clearFormErrors('project');

  const idInput = document.getElementById('projectIdInput').value;
  const title = document.getElementById('projectTitleInput').value.trim();
  const desc = document.getElementById('projectDescInput').value.trim();
  const owner = document.getElementById('projectOwnerInput').value.trim();
  const dueDate = document.getElementById('projectDueDateInput').value;

  // Validation
  let hasError = false;
  if (!title) {
    setFormError('projectTitleError', 'Project title is required.');
    hasError = true;
  }
  if (!desc) {
    setFormError('projectDescError', 'Project description is required.');
    hasError = true;
  }
  if (!owner) {
    setFormError('projectOwnerError', 'Project owner name is required.');
    hasError = true;
  }

  if (hasError) return;

  // Gather selected members
  const memberCheckboxes = document.querySelectorAll('input[name="projectMember"]:checked');
  const selectedMembers = Array.from(memberCheckboxes).map(cb => cb.value);

  try {
    if (idInput) {
      // Update
      const existing = AppState.projects.find(p => p.id === idInput);
      const updatedProject = {
        ...existing,
        title,
        description: desc,
        owner,
        dueDate,
        members: selectedMembers,
        updatedAt: new Date().toISOString()
      };
      await db.update('projects', updatedProject);
      showToast(`Project "${title}" updated successfully!`, 'success');
    } else {
      // Create
      const newProject = {
        id: generateId('proj'),
        title,
        description: desc,
        owner,
        dueDate,
        members: selectedMembers,
        createdAt: new Date().toISOString()
      };
      await db.add('projects', newProject);
      showToast(`Project "${title}" created successfully!`, 'success');
    }

    closeModal('projectModal');
    await loadAllDataFromDB();
  } catch (err) {
    console.error('Error saving project:', err);
    showToast('Failed to save project. Please try again.', 'error');
  }
}

// Open Project Details View Modal
function openProjectDetailsModal(projectId) {
  const project = AppState.projects.find(p => p.id === projectId);
  if (!project) return;

  AppState.currentlyViewingProjectId = projectId;

  document.getElementById('projectDetailsTitle').textContent = project.title;
  document.getElementById('projectDetailsDesc').textContent = project.description;
  document.getElementById('projectDetailsOwner').textContent = `Owner: ${project.owner}`;
  document.getElementById('projectDetailsCreatedDate').textContent = `Created: ${formatDate(project.createdAt)}`;

  // Progress calculations
  const projectTasks = AppState.tasks.filter(t => t.projectId === project.id);
  const total = projectTasks.length;
  const completed = projectTasks.filter(t => t.status === 'Completed').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('projectDetailsPercent').textContent = `${percent}%`;
  document.getElementById('projectDetailsProgressBar').style.width = `${percent}%`;
  document.getElementById('projectDetailsTasksRatio').textContent = `${completed} of ${total} tasks completed`;

  // Members
  const membersListEl = document.getElementById('projectDetailsMembersList');
  if (membersListEl) {
    const assignedMembers = (project.members || []).map(mid => AppState.members.find(m => m.id === mid)).filter(Boolean);
    if (assignedMembers.length === 0) {
      membersListEl.innerHTML = `<span class="text-xs text-muted">No contributors explicitly assigned yet.</span>`;
    } else {
      membersListEl.innerHTML = assignedMembers.map(m => `
        <div class="avatar-chip">
          <div class="user-avatar avatar-sm">${getInitials(m.name)}</div>
          <span>${escapeHTML(m.name)} (${escapeHTML(m.role)})</span>
        </div>
      `).join('');
    }
  }

  // Tasks Table inside Project Details
  const tasksTable = document.getElementById('projectDetailsTasksTable');
  if (tasksTable) {
    if (projectTasks.length === 0) {
      tasksTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:1.5rem;">No tasks created for this project yet.</td></tr>`;
    } else {
      tasksTable.innerHTML = projectTasks.map(t => {
        const m = AppState.members.find(mem => mem.id === t.assignedTo);
        const name = m ? m.name : (t.assignedTo || 'Unassigned');
        return `
          <tr style="cursor:pointer;" onclick="closeModal('projectDetailsModal'); openTaskDetailsModal('${t.id}')">
            <td><strong class="text-sm">${escapeHTML(t.title)}</strong></td>
            <td><span class="text-xs">${escapeHTML(name)}</span></td>
            <td><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
            <td><span class="badge badge-${t.status.toLowerCase().replace(' ', '')}">${t.status}</span></td>
            <td><span class="text-xs text-muted">${formatDate(t.dueDate)}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Setup buttons inside Project Details modal
  const editBtn = document.getElementById('projectDetailsEditBtn');
  const deleteBtn = document.getElementById('projectDetailsDeleteBtn');
  const addTaskBtn = document.getElementById('projectDetailsAddTaskBtn');

  if (editBtn) {
    editBtn.onclick = () => {
      closeModal('projectDetailsModal');
      openEditProjectModal(project.id);
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = () => {
      closeModal('projectDetailsModal');
      promptDeleteProject(project.id, project.title);
    };
  }

  if (addTaskBtn) {
    addTaskBtn.onclick = () => {
      closeModal('projectDetailsModal');
      openCreateTaskModal(project.id);
    };
  }

  openModal('projectDetailsModal');
}

// Delete Project with Cascading Confirmation
function promptDeleteProject(projectId, projectTitle) {
  const relatedTasksCount = AppState.tasks.filter(t => t.projectId === projectId).length;

  openConfirmModal({
    title: 'Delete Project',
    message: `Are you sure you want to permanently delete the project "${projectTitle}"?`,
    submessage: relatedTasksCount > 0
      ? `⚠️ WARNING: This project has ${relatedTasksCount} associated task(s) and their comments which will also be permanently removed.`
      : 'This action cannot be undone.',
    confirmBtnText: 'Delete Project & Tasks',
    onConfirm: async () => {
      try {
        await db.deleteProjectCascading(projectId);
        showToast(`Project "${projectTitle}" and all related tasks deleted.`, 'info');
        await loadAllDataFromDB();
      } catch (err) {
        console.error('Error deleting project:', err);
        showToast('Failed to delete project.', 'error');
      }
    }
  });
}

// ==========================================================================
// 9. TASK MANAGEMENT & KANBAN DRAG-AND-DROP
// ==========================================================================
function renderTasks() {
  const { tasks, projects, members, filters, taskViewMode } = AppState;

  // Sync Project Filter dropdown options
  const filterProj = document.getElementById('taskFilterProject');
  if (filterProj) {
    const currentVal = filters.taskProject;
    filterProj.innerHTML = `<option value="all">All Projects</option>` +
      projects.map(p => `<option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>${escapeHTML(p.title)}</option>`).join('');
  }

  // Sync Assignee Filter dropdown options
  const filterAssignee = document.getElementById('taskFilterAssignee');
  if (filterAssignee) {
    const currentVal = filters.taskAssignee;
    filterAssignee.innerHTML = `<option value="all">All Members</option>` +
      members.map(m => `<option value="${m.id}" ${m.id === currentVal ? 'selected' : ''}>${escapeHTML(m.name)}</option>`).join('');
  }

  // Filter Tasks
  let filtered = [...tasks];

  // Search
  if (filters.taskSearch.trim()) {
    const q = filters.taskSearch.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }

  // Project
  if (filters.taskProject !== 'all') {
    filtered = filtered.filter(t => t.projectId === filters.taskProject);
  }

  // Priority
  if (filters.taskPriority !== 'all') {
    filtered = filtered.filter(t => t.priority === filters.taskPriority);
  }

  // Assignee
  if (filters.taskAssignee !== 'all') {
    filtered = filtered.filter(t => t.assignedTo === filters.taskAssignee);
  }

  // Status (for list view)
  if (filters.taskStatus !== 'all') {
    filtered = filtered.filter(t => t.status === filters.taskStatus);
  }

  // Render Active Filter Chips
  renderFilterChips();

  // Empty state handling
  const kanbanContainer = document.getElementById('kanbanContainer');
  const tableContainer = document.getElementById('tasksTableContainer');
  const emptyState = document.getElementById('tasksEmptyState');
  const emptyMsg = document.getElementById('tasksEmptyMsg');

  if (filtered.length === 0) {
    if (kanbanContainer) kanbanContainer.classList.add('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (emptyMsg) {
      emptyMsg.textContent = tasks.length === 0
        ? 'No tasks created yet. Click "New Task" to create one.'
        : 'No tasks match the selected filters. Try clearing some filters.';
    }
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (taskViewMode === 'kanban') {
    if (kanbanContainer) kanbanContainer.classList.remove('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
    renderKanbanBoard(filtered);
  } else {
    if (kanbanContainer) kanbanContainer.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');
    renderTasksTable(filtered);
  }
}

function renderKanbanBoard(tasksList) {
  const statuses = ['To Do', 'In Progress', 'Completed'];

  statuses.forEach(status => {
    const colSlug = status.toLowerCase().replace(' ', '');
    const dropzone = document.getElementById(`dropzone-${colSlug}`);
    const countBadge = document.getElementById(`count-${colSlug}`);

    const colTasks = tasksList.filter(t => t.status === status);

    if (countBadge) countBadge.textContent = colTasks.length;

    if (dropzone) {
      if (colTasks.length === 0) {
        dropzone.innerHTML = `
          <div style="padding:2rem 1rem;text-align:center;color:var(--text-light);font-size:0.8rem;border:1px dashed var(--border-color);border-radius:var(--radius-md);">
            No tasks in ${status}
          </div>
        `;
      } else {
        dropzone.innerHTML = colTasks.map(t => {
          const proj = AppState.projects.find(p => p.id === t.projectId);
          const member = AppState.members.find(m => m.id === t.assignedTo);
          const assigneeName = member ? member.name : (t.assignedTo || 'Unassigned');
          const overdue = isOverdue(t.dueDate, t.status);
          const commentsCount = AppState.comments.filter(c => c.taskId === t.id).length;

          return `
            <div 
              class="task-card" 
              draggable="true" 
              data-task-id="${t.id}" 
              id="card-${t.id}"
            >
              <div class="task-card-header">
                <span class="task-card-project-pill">${escapeHTML(proj ? proj.title : 'Project')}</span>
                <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
              </div>

              <h4 class="task-card-title" onclick="openTaskDetailsModal('${t.id}')">${escapeHTML(t.title)}</h4>
              <p class="task-card-desc">${escapeHTML(t.description)}</p>

              <div class="task-card-footer">
                <div class="task-card-meta-left">
                  <div class="user-avatar avatar-sm" title="Assigned to ${escapeHTML(assigneeName)}">
                    ${getInitials(assigneeName)}
                  </div>
                  <span class="task-due-date ${overdue ? 'is-overdue' : ''}">
                    ${overdue ? '⚠️ ' : ''}${formatDate(t.dueDate)}
                  </span>
                </div>

                <div class="flex-center gap-2">
                  ${commentsCount > 0 ? `
                    <span class="text-xs text-muted" title="${commentsCount} comment(s)">💬 ${commentsCount}</span>
                  ` : ''}

                  <!-- Accessible Quick Status Change Dropdown -->
                  <select 
                    class="task-card-quick-status" 
                    title="Change task status directly"
                    onchange="changeTaskStatusDirectly('${t.id}', this.value)"
                  >
                    <option value="To Do" ${t.status === 'To Do' ? 'selected' : ''}>To Do</option>
                    <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  });

  // Re-attach HTML5 Drag and Drop listeners
  setupDragAndDrop();
}

function renderTasksTable(tasksList) {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;

  tbody.innerHTML = tasksList.map(t => {
    const proj = AppState.projects.find(p => p.id === t.projectId);
    const member = AppState.members.find(m => m.id === t.assignedTo);
    const assigneeName = member ? member.name : (t.assignedTo || 'Unassigned');
    const overdue = isOverdue(t.dueDate, t.status);

    return `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="openTaskDetailsModal('${t.id}')" class="font-semibold text-sm" style="color:var(--text-main);">
            ${escapeHTML(t.title)}
          </a>
          <span class="text-xs text-muted" style="display:block;">${escapeHTML(t.description.substring(0, 60))}...</span>
        </td>
        <td><span class="text-xs font-semibold">${escapeHTML(proj ? proj.title : 'General')}</span></td>
        <td>
          <div class="flex-center gap-2">
            <div class="user-avatar avatar-sm">${getInitials(assigneeName)}</div>
            <span class="text-xs">${escapeHTML(assigneeName)}</span>
          </div>
        </td>
        <td><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
        <td>
          <select class="form-select form-select-sm" onchange="changeTaskStatusDirectly('${t.id}', this.value)" style="width:auto;">
            <option value="To Do" ${t.status === 'To Do' ? 'selected' : ''}>To Do</option>
            <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
        <td>
          <span class="text-xs ${overdue ? 'text-danger font-bold' : 'text-muted'}">
            ${overdue ? '⚠️ ' : ''}${formatDate(t.dueDate)}
          </span>
        </td>
        <td class="text-right">
          <button class="btn btn-sm btn-ghost" onclick="openTaskDetailsModal('${t.id}')">View</button>
          <button class="btn btn-sm btn-outline" onclick="openEditTaskModal('${t.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="promptDeleteTask('${t.id}', '${escapeHTML(t.title)}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderFilterChips() {
  const container = document.getElementById('filterChipsList');
  const bar = document.getElementById('activeFiltersBar');
  if (!container || !bar) return;

  const chips = [];
  const { filters, projects, members } = AppState;

  if (filters.taskSearch) {
    chips.push({ key: 'taskSearch', label: `Search: "${filters.taskSearch}"` });
  }
  if (filters.taskProject !== 'all') {
    const p = projects.find(pr => pr.id === filters.taskProject);
    chips.push({ key: 'taskProject', label: `Project: ${p ? p.title : filters.taskProject}` });
  }
  if (filters.taskPriority !== 'all') {
    chips.push({ key: 'taskPriority', label: `Priority: ${filters.taskPriority}` });
  }
  if (filters.taskAssignee !== 'all') {
    const m = members.find(mem => mem.id === filters.taskAssignee);
    chips.push({ key: 'taskAssignee', label: `Assignee: ${m ? m.name : filters.taskAssignee}` });
  }
  if (filters.taskStatus !== 'all') {
    chips.push({ key: 'taskStatus', label: `Status: ${filters.taskStatus}` });
  }

  if (chips.length === 0) {
    bar.classList.add('hidden');
    container.innerHTML = '';
  } else {
    bar.classList.remove('hidden');
    container.innerHTML = chips.map(chip => `
      <div class="filter-chip">
        <span>${escapeHTML(chip.label)}</span>
        <button type="button" onclick="clearSpecificFilter('${chip.key}')" aria-label="Remove filter">&times;</button>
      </div>
    `).join('');
  }
}

function clearSpecificFilter(key) {
  if (key === 'taskSearch') {
    AppState.filters.taskSearch = '';
    const input = document.getElementById('taskSearchInput');
    if (input) input.value = '';
  } else if (key === 'taskProject') {
    AppState.filters.taskProject = 'all';
    const sel = document.getElementById('taskFilterProject');
    if (sel) sel.value = 'all';
  } else if (key === 'taskPriority') {
    AppState.filters.taskPriority = 'all';
    const sel = document.getElementById('taskFilterPriority');
    if (sel) sel.value = 'all';
  } else if (key === 'taskAssignee') {
    AppState.filters.taskAssignee = 'all';
    const sel = document.getElementById('taskFilterAssignee');
    if (sel) sel.value = 'all';
  } else if (key === 'taskStatus') {
    AppState.filters.taskStatus = 'all';
    const sel = document.getElementById('taskFilterStatus');
    if (sel) sel.value = 'all';
  }

  renderTasks();
}

function clearAllTaskFilters() {
  AppState.filters.taskSearch = '';
  AppState.filters.taskProject = 'all';
  AppState.filters.taskPriority = 'all';
  AppState.filters.taskAssignee = 'all';
  AppState.filters.taskStatus = 'all';

  const sInput = document.getElementById('taskSearchInput');
  const fProj = document.getElementById('taskFilterProject');
  const fPrio = document.getElementById('taskFilterPriority');
  const fAss = document.getElementById('taskFilterAssignee');
  const fStat = document.getElementById('taskFilterStatus');

  if (sInput) sInput.value = '';
  if (fProj) fProj.value = 'all';
  if (fPrio) fPrio.value = 'all';
  if (fAss) fAss.value = 'all';
  if (fStat) fStat.value = 'all';

  renderTasks();
}

// Native HTML5 Drag and Drop Implementation
let draggedTaskId = null;

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card[draggable="true"]');
  const dropzones = document.querySelectorAll('.kanban-dropzone');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedTaskId = null;
      dropzones.forEach(dz => dz.classList.remove('dragover'));
    });
  });

  dropzones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', (e) => {
      // Avoid flickering when hovering over card children
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('dragover');
      }
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
      const targetStatus = zone.dataset.dropStatus;

      if (taskId && targetStatus) {
        await changeTaskStatusDirectly(taskId, targetStatus);
      }
    });
  });
}

// Change task status directly (both for drag & drop and accessible select controls)
async function changeTaskStatusDirectly(taskId, newStatus) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task || task.status === newStatus) return;

  const oldStatus = task.status;
  task.status = newStatus;

  try {
    await db.update('tasks', task);
    showToast(`Task moved from "${oldStatus}" to "${newStatus}"`, 'success', 2500);

    // Refresh UI & statistics
    await loadAllDataFromDB();
  } catch (err) {
    console.error('Failed to update task status in IndexedDB:', err);
    task.status = oldStatus; // Rollback
    showToast('Failed to update task status.', 'error');
  }
}

// Open Task Create Modal
function openCreateTaskModal(preselectedProjectId = '', defaultStatus = 'To Do') {
  AppState.currentlyEditingTaskId = null;
  const form = document.getElementById('taskForm');
  const title = document.getElementById('taskModalTitle');

  if (form) form.reset();
  document.getElementById('taskIdInput').value = '';
  if (title) title.textContent = 'Create New Task';

  // Sync Project Dropdown
  const projSelect = document.getElementById('taskProjectSelect');
  if (projSelect) {
    projSelect.innerHTML = `<option value="">Select a project...</option>` +
      AppState.projects.map(p => `<option value="${p.id}" ${p.id === preselectedProjectId ? 'selected' : ''}>${escapeHTML(p.title)}</option>`).join('');
  }

  // Sync Member Dropdown
  const assigneeSelect = document.getElementById('taskAssigneeSelect');
  if (assigneeSelect) {
    assigneeSelect.innerHTML = `<option value="">Assign to team member...</option>` +
      AppState.members.map(m => `<option value="${m.id}">${escapeHTML(m.name)} (${escapeHTML(m.role)})</option>`).join('');
  }

  // Set default status & today + 7d due date
  const statusSelect = document.getElementById('taskStatusSelect');
  if (statusSelect) statusSelect.value = defaultStatus;

  const dueInput = document.getElementById('taskDueDateInput');
  if (dueInput) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    dueInput.value = d.toISOString().split('T')[0];
  }

  clearFormErrors('task');
  openModal('taskModal');
}

// Open Task Edit Modal
function openEditTaskModal(taskId) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task) return;

  AppState.currentlyEditingTaskId = taskId;
  const title = document.getElementById('taskModalTitle');
  if (title) title.textContent = 'Edit Task';

  document.getElementById('taskIdInput').value = task.id;
  document.getElementById('taskTitleInput').value = task.title;
  document.getElementById('taskDescInput').value = task.description;

  // Sync Project Dropdown
  const projSelect = document.getElementById('taskProjectSelect');
  if (projSelect) {
    projSelect.innerHTML = `<option value="">Select a project...</option>` +
      AppState.projects.map(p => `<option value="${p.id}" ${p.id === task.projectId ? 'selected' : ''}>${escapeHTML(p.title)}</option>`).join('');
  }

  // Sync Member Dropdown
  const assigneeSelect = document.getElementById('taskAssigneeSelect');
  if (assigneeSelect) {
    assigneeSelect.innerHTML = `<option value="">Assign to team member...</option>` +
      AppState.members.map(m => `<option value="${m.id}" ${m.id === task.assignedTo ? 'selected' : ''}>${escapeHTML(m.name)} (${escapeHTML(m.role)})</option>`).join('');
  }

  document.getElementById('taskPrioritySelect').value = task.priority;
  document.getElementById('taskStatusSelect').value = task.status;
  document.getElementById('taskDueDateInput').value = task.dueDate;

  clearFormErrors('task');
  openModal('taskModal');
}

// Save Task (Create / Update)
async function handleTaskFormSubmit(e) {
  e.preventDefault();
  clearFormErrors('task');

  const idInput = document.getElementById('taskIdInput').value;
  const title = document.getElementById('taskTitleInput').value.trim();
  const desc = document.getElementById('taskDescInput').value.trim();
  const projectId = document.getElementById('taskProjectSelect').value;
  const assignedTo = document.getElementById('taskAssigneeSelect').value;
  const priority = document.getElementById('taskPrioritySelect').value;
  const status = document.getElementById('taskStatusSelect').value;
  const dueDate = document.getElementById('taskDueDateInput').value;

  let hasError = false;
  if (!title) {
    setFormError('taskTitleError', 'Task title is required.');
    hasError = true;
  }
  if (!desc) {
    setFormError('taskDescError', 'Task description is required.');
    hasError = true;
  }
  if (!projectId) {
    setFormError('taskProjectError', 'Please choose a project for this task.');
    hasError = true;
  }
  if (!assignedTo) {
    setFormError('taskAssigneeError', 'Please assign this task to a member.');
    hasError = true;
  }
  if (!dueDate) {
    setFormError('taskDueDateError', 'Please choose a due date.');
    hasError = true;
  }

  if (hasError) return;

  try {
    if (idInput) {
      // Update
      const existing = AppState.tasks.find(t => t.id === idInput);
      const updated = {
        ...existing,
        title,
        description: desc,
        projectId,
        assignedTo,
        priority,
        status,
        dueDate,
        updatedAt: new Date().toISOString()
      };
      await db.update('tasks', updated);
      showToast(`Task "${title}" updated!`, 'success');
    } else {
      // Create
      const newTask = {
        id: generateId('task'),
        title,
        description: desc,
        projectId,
        assignedTo,
        priority,
        status,
        dueDate,
        createdAt: new Date().toISOString()
      };
      await db.add('tasks', newTask);
      showToast(`Task "${title}" created!`, 'success');
    }

    closeModal('taskModal');
    await loadAllDataFromDB();
  } catch (err) {
    console.error('Error saving task:', err);
    showToast('Failed to save task to IndexedDB.', 'error');
  }
}

// Open Task Details & Comments Modal
async function openTaskDetailsModal(taskId) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task) return;

  AppState.currentlyViewingTaskId = taskId;

  document.getElementById('taskDetailsModalTitle').textContent = task.title;
  document.getElementById('taskDetailsDescription').textContent = task.description;
  document.getElementById('taskDetailsDueDate').textContent = formatDate(task.dueDate);

  // Status & Priority Badges
  const statusBadge = document.getElementById('taskDetailsStatusBadge');
  const priorityBadge = document.getElementById('taskDetailsPriorityBadge');
  const overdueBadge = document.getElementById('taskDetailsOverdueBadge');

  if (statusBadge) {
    statusBadge.className = `badge badge-${task.status.toLowerCase().replace(' ', '')}`;
    statusBadge.textContent = task.status;
  }

  if (priorityBadge) {
    priorityBadge.className = `badge badge-${task.priority.toLowerCase()}`;
    priorityBadge.textContent = `${task.priority} Priority`;
  }

  const overdue = isOverdue(task.dueDate, task.status);
  if (overdueBadge) {
    overdueBadge.classList.toggle('hidden', !overdue);
  }

  // Project Name
  const proj = AppState.projects.find(p => p.id === task.projectId);
  document.getElementById('taskDetailsProjectName').textContent = proj ? proj.title : 'General / None';

  // Assignee
  const member = AppState.members.find(m => m.id === task.assignedTo);
  const assigneeName = member ? member.name : (task.assignedTo || 'Unassigned');
  document.getElementById('taskDetailsAssigneeName').textContent = assigneeName;
  document.getElementById('taskDetailsAssigneeAvatar').textContent = getInitials(assigneeName);

  // Quick Status Select inside details modal
  const statusSelect = document.getElementById('taskDetailsStatusSelect');
  if (statusSelect) {
    statusSelect.value = task.status;
    statusSelect.onchange = async () => {
      await changeTaskStatusDirectly(task.id, statusSelect.value);
      openTaskDetailsModal(task.id); // re-render details
    };
  }

  // Author input for new comments (defaults to user display name)
  const commentAuthorInput = document.getElementById('commentAuthorInput');
  if (commentAuthorInput) {
    commentAuthorInput.value = AppState.settings.displayName || 'Project Lead';
  }

  // Load and render comments for this task
  await renderTaskComments(task.id);

  // Wire Edit & Delete in modal footer
  const editBtn = document.getElementById('taskDetailsEditBtn');
  const deleteBtn = document.getElementById('taskDetailsDeleteBtn');

  if (editBtn) {
    editBtn.onclick = () => {
      closeModal('taskDetailsModal');
      openEditTaskModal(task.id);
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = () => {
      closeModal('taskDetailsModal');
      promptDeleteTask(task.id, task.title);
    };
  }

  openModal('taskDetailsModal');
}

// Render Comments inside Task Modal
async function renderTaskComments(taskId) {
  const feed = document.getElementById('taskCommentsFeed');
  const countBadge = document.getElementById('taskCommentsCount');
  if (!feed) return;

  try {
    const comments = await db.getCommentsByTaskId(taskId);
    if (countBadge) countBadge.textContent = comments.length;

    if (comments.length === 0) {
      feed.innerHTML = `
        <div class="empty-comments-state">
          <p>No comments posted yet. Add a milestone update or question below!</p>
        </div>
      `;
    } else {
      feed.innerHTML = comments.map(c => `
        <div class="comment-bubble">
          <div class="comment-bubble-header">
            <span class="comment-author">${escapeHTML(c.author)}</span>
            <span class="comment-timestamp">${formatDateTime(c.createdAt)}</span>
          </div>
          <div class="comment-body">${escapeHTML(c.content)}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error fetching comments:', err);
    feed.innerHTML = `<p class="text-xs text-danger">Error loading comments from IndexedDB.</p>`;
  }
}

// Handle Add Comment
async function handleCommentFormSubmit(e) {
  e.preventDefault();
  const taskId = AppState.currentlyViewingTaskId;
  if (!taskId) return;

  const authorInput = document.getElementById('commentAuthorInput');
  const textInput = document.getElementById('commentTextInput');

  const author = authorInput.value.trim();
  const content = textInput.value.trim();

  if (!author || !content) {
    showToast('Comment text cannot be empty.', 'error');
    return;
  }

  const newComment = {
    id: generateId('comm'),
    taskId,
    author,
    content,
    createdAt: new Date().toISOString()
  };

  try {
    await db.add('comments', newComment);
    textInput.value = '';
    showToast('Comment added!', 'success', 2000);

    // Refresh comments list
    await renderTaskComments(taskId);
    await loadAllDataFromDB();
  } catch (err) {
    console.error('Failed to post comment:', err);
    showToast('Failed to save comment.', 'error');
  }
}

// Delete Task with Confirmation
function promptDeleteTask(taskId, taskTitle) {
  openConfirmModal({
    title: 'Delete Task',
    message: `Are you sure you want to permanently delete the task "${taskTitle}"?`,
    submessage: 'All associated comments on this task will also be removed.',
    confirmBtnText: 'Delete Task',
    onConfirm: async () => {
      try {
        await db.deleteTaskCascading(taskId);
        showToast(`Task "${taskTitle}" deleted.`, 'info');
        await loadAllDataFromDB();
      } catch (err) {
        console.error('Error deleting task:', err);
        showToast('Failed to delete task.', 'error');
      }
    }
  });
}

// ==========================================================================
// 10. TEAM MEMBER MANAGEMENT
// ==========================================================================
function renderTeam() {
  const { members, tasks, filters } = AppState;
  const grid = document.getElementById('teamMembersGrid');
  const emptyState = document.getElementById('teamEmptyState');

  let filtered = [...members];
  if (filters.memberSearch.trim()) {
    const q = filters.memberSearch.toLowerCase();
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    if (grid) grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (grid) {
    grid.innerHTML = filtered.map(m => {
      const assignedTasks = tasks.filter(t => t.assignedTo === m.id || t.assignedTo === m.name);
      const completedCount = assignedTasks.filter(t => t.status === 'Completed').length;

      return `
        <div class="member-card" data-member-id="${m.id}">
          <div class="member-avatar-lg">${getInitials(m.name)}</div>
          <h3 class="member-name">${escapeHTML(m.name)}</h3>
          <span class="member-role">${escapeHTML(m.role)}</span>
          <span class="member-email font-mono">${escapeHTML(m.email)}</span>

          <div class="member-stats-row">
            <div class="member-stat-box">
              <span class="member-stat-num">${assignedTasks.length}</span>
              <span class="member-stat-label">Assigned</span>
            </div>
            <div class="member-stat-box">
              <span class="member-stat-num text-success">${completedCount}</span>
              <span class="member-stat-label">Completed</span>
            </div>
          </div>

          <div class="member-actions">
            <button class="btn btn-sm btn-outline flex-grow" onclick="openEditMemberModal('${m.id}')">Edit</button>
            <button class="btn btn-sm btn-danger flex-grow" onclick="promptDeleteMember('${m.id}', '${escapeHTML(m.name)}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function openCreateMemberModal() {
  AppState.currentlyEditingMemberId = null;
  const form = document.getElementById('memberForm');
  const title = document.getElementById('memberModalTitle');

  if (form) form.reset();
  document.getElementById('memberIdInput').value = '';
  if (title) title.textContent = 'Add Team Member';

  clearFormErrors('member');
  openModal('memberModal');
}

function openEditMemberModal(memberId) {
  const member = AppState.members.find(m => m.id === memberId);
  if (!member) return;

  AppState.currentlyEditingMemberId = memberId;
  const title = document.getElementById('memberModalTitle');
  if (title) title.textContent = 'Edit Team Member';

  document.getElementById('memberIdInput').value = member.id;
  document.getElementById('memberNameInput').value = member.name;
  document.getElementById('memberEmailInput').value = member.email;
  document.getElementById('memberRoleInput').value = member.role;

  clearFormErrors('member');
  openModal('memberModal');
}

async function handleMemberFormSubmit(e) {
  e.preventDefault();
  clearFormErrors('member');

  const idInput = document.getElementById('memberIdInput').value;
  const name = document.getElementById('memberNameInput').value.trim();
  const email = document.getElementById('memberEmailInput').value.trim().toLowerCase();
  const role = document.getElementById('memberRoleInput').value.trim();

  let hasError = false;
  if (!name) {
    setFormError('memberNameError', 'Member name is required.');
    hasError = true;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    setFormError('memberEmailError', 'Please enter a valid email address.');
    hasError = true;
  }

  // Duplicate email check
  const duplicate = AppState.members.find(m => m.email === email && m.id !== idInput);
  if (duplicate) {
    setFormError('memberEmailError', 'A team member with this email address already exists.');
    hasError = true;
  }

  if (!role) {
    setFormError('memberRoleError', 'Role or specialization is required.');
    hasError = true;
  }

  if (hasError) return;

  try {
    if (idInput) {
      // Update
      const existing = AppState.members.find(m => m.id === idInput);
      const updated = {
        ...existing,
        name,
        email,
        role,
        updatedAt: new Date().toISOString()
      };
      await db.update('members', updated);
      showToast(`Member "${name}" updated!`, 'success');
    } else {
      // Create
      const newMember = {
        id: generateId('mem'),
        name,
        email,
        role,
        createdAt: new Date().toISOString()
      };
      await db.add('members', newMember);
      showToast(`Member "${name}" added to team!`, 'success');
    }

    closeModal('memberModal');
    await loadAllDataFromDB();
  } catch (err) {
    console.error('Error saving team member:', err);
    showToast('Failed to save team member in IndexedDB.', 'error');
  }
}

// Safe Member Deletion Check (Prevents accidental deletion with assigned tasks)
function promptDeleteMember(memberId, memberName) {
  const assignedTasks = AppState.tasks.filter(t => t.assignedTo === memberId || t.assignedTo === memberName);

  if (assignedTasks.length > 0) {
    openConfirmModal({
      title: 'Cannot Delete Member',
      message: `"${memberName}" currently has ${assignedTasks.length} assigned task(s).`,
      submessage: 'To maintain project integrity, please reassign or unassign their tasks before removing this contributor from the team roster.',
      confirmBtnText: 'Understood',
      onConfirm: () => {
        // Just dismiss
      }
    });
    return;
  }

  openConfirmModal({
    title: 'Remove Team Member',
    message: `Are you sure you want to remove "${memberName}" from the team directory?`,
    submessage: 'This action cannot be undone.',
    confirmBtnText: 'Remove Member',
    onConfirm: async () => {
      try {
        await db.delete('members', memberId);
        showToast(`Team member "${memberName}" removed.`, 'info');
        await loadAllDataFromDB();
      } catch (err) {
        console.error('Error removing member:', err);
        showToast('Failed to delete member.', 'error');
      }
    }
  });
}

// ==========================================================================
// 11. SETTINGS & STORAGE MANAGEMENT
// ==========================================================================
function renderSettings() {
  const countProjects = document.getElementById('settingsCountProjects');
  const countTasks = document.getElementById('settingsCountTasks');
  const countMembers = document.getElementById('settingsCountMembers');
  const countComments = document.getElementById('settingsCountComments');

  if (countProjects) countProjects.textContent = `${AppState.projects.length} records`;
  if (countTasks) countTasks.textContent = `${AppState.tasks.length} records`;
  if (countMembers) countMembers.textContent = `${AppState.members.length} records`;
  if (countComments) countComments.textContent = `${AppState.comments.length} records`;
}

async function handleProfileSettingsSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('settingsDisplayName').value.trim();
  const roleInput = document.getElementById('settingsUserRole').value.trim();

  if (!nameInput) {
    showToast('Display Name cannot be empty.', 'error');
    return;
  }

  try {
    await db.setSetting('displayName', nameInput);
    await db.setSetting('userRole', roleInput);

    AppState.settings.displayName = nameInput;
    AppState.settings.userRole = roleInput;

    updateUserProfileDisplay();
    showToast('Profile preferences saved to IndexedDB!', 'success');
  } catch (err) {
    console.error('Error saving profile settings:', err);
    showToast('Failed to save settings.', 'error');
  }
}

async function handleThemeChange(newTheme) {
  try {
    await db.setSetting('theme', newTheme);
    applyTheme(newTheme);
    showToast(`Theme switched to ${newTheme === 'dark' ? 'Dark Slate' : 'Clean Light'}.`, 'info', 2000);
  } catch (err) {
    console.error('Error saving theme setting:', err);
  }
}

function promptClearAllData() {
  openConfirmModal({
    title: 'Wipe All Data',
    message: 'Are you sure you want to completely erase all projects, tasks, comments, and team members from browser storage?',
    submessage: '⚠️ This will clear your entire IndexedDB database for TaskFlow. This operation is permanent and cannot be undone.',
    confirmBtnText: 'Clear Everything',
    onConfirm: async () => {
      try {
        await db.clearAll();
        showToast('All local application data cleared.', 'info');
        await loadAllDataFromDB();
      } catch (err) {
        console.error('Error clearing data:', err);
        showToast('Failed to clear application data.', 'error');
      }
    }
  });
}

// ==========================================================================
// 12. GLOBAL SEARCH & NOTIFICATIONS
// ==========================================================================
function handleGlobalSearch(query) {
  const popover = document.getElementById('searchResultsPopover');
  const list = document.getElementById('searchResultsList');
  const clearBtn = document.getElementById('globalSearchClear');

  if (!query.trim()) {
    if (popover) popover.classList.add('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
    return;
  }

  if (clearBtn) clearBtn.classList.remove('hidden');

  const q = query.toLowerCase();
  const matchedProjects = AppState.projects.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)).slice(0, 3);
  const matchedTasks = AppState.tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)).slice(0, 4);
  const matchedMembers = AppState.members.filter(m => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)).slice(0, 3);

  const totalMatches = matchedProjects.length + matchedTasks.length + matchedMembers.length;

  if (totalMatches === 0) {
    list.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">No matching projects, tasks, or team members found.</div>`;
  } else {
    let html = '';

    matchedProjects.forEach(p => {
      html += `
        <div class="search-result-item" onclick="selectSearchResult('project', '${p.id}')">
          <div>
            <div class="font-bold text-sm">${escapeHTML(p.title)}</div>
            <span class="text-xs text-muted">Owner: ${escapeHTML(p.owner)}</span>
          </div>
          <span class="search-result-type">Project</span>
        </div>
      `;
    });

    matchedTasks.forEach(t => {
      html += `
        <div class="search-result-item" onclick="selectSearchResult('task', '${t.id}')">
          <div>
            <div class="font-bold text-sm">${escapeHTML(t.title)}</div>
            <span class="text-xs text-muted">${t.status} · ${t.priority} Priority</span>
          </div>
          <span class="search-result-type" style="background-color:var(--purple-100);color:var(--purple-700);">Task</span>
        </div>
      `;
    });

    matchedMembers.forEach(m => {
      html += `
        <div class="search-result-item" onclick="selectSearchResult('member', '${m.id}')">
          <div>
            <div class="font-bold text-sm">${escapeHTML(m.name)}</div>
            <span class="text-xs text-muted">${escapeHTML(m.role)}</span>
          </div>
          <span class="search-result-type" style="background-color:var(--info-100);color:var(--info-600);">Member</span>
        </div>
      `;
    });

    list.innerHTML = html;
  }

  if (popover) popover.classList.remove('hidden');
}

function selectSearchResult(type, id) {
  const popover = document.getElementById('searchResultsPopover');
  if (popover) popover.classList.add('hidden');

  if (type === 'project') {
    navigateTo('projects');
    openProjectDetailsModal(id);
  } else if (type === 'task') {
    navigateTo('tasks');
    openTaskDetailsModal(id);
  } else if (type === 'member') {
    navigateTo('team');
  }
}

// Notifications Menu Populator
function updateNotificationsBadge() {
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationsList');

  // Calculate overdue & upcoming tasks
  const overdueTasks = AppState.tasks.filter(t => isOverdue(t.dueDate, t.status));
  const upcomingTasks = AppState.tasks.filter(t => {
    if (!t.dueDate || t.status === 'Completed') return false;
    const days = getDaysRemaining(t.dueDate);
    return days !== null && days >= 0 && days <= 2;
  });

  const totalAlerts = overdueTasks.length + upcomingTasks.length;

  if (badge) {
    badge.textContent = totalAlerts;
    badge.style.display = totalAlerts > 0 ? 'flex' : 'none';
  }

  if (list) {
    if (totalAlerts === 0) {
      list.innerHTML = `
        <div class="empty-notifications" style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          <p>No new deadline alerts!</p>
          <span class="text-xs">All tasks are currently on schedule.</span>
        </div>
      `;
    } else {
      let html = '';

      overdueTasks.forEach(t => {
        html += `
          <div class="notification-item warning" style="cursor:pointer;" onclick="openTaskDetailsModal('${t.id}')">
            <div class="notification-icon">⚠️</div>
            <div>
              <div class="notification-title">Task Overdue: ${escapeHTML(t.title)}</div>
              <div class="notification-time">Due on ${formatDate(t.dueDate)}</div>
            </div>
          </div>
        `;
      });

      upcomingTasks.forEach(t => {
        html += `
          <div class="notification-item" style="cursor:pointer;" onclick="openTaskDetailsModal('${t.id}')">
            <div class="notification-icon">⏰</div>
            <div>
              <div class="notification-title">Upcoming Due: ${escapeHTML(t.title)}</div>
              <div class="notification-time">Due in ${getDaysRemaining(t.dueDate)} day(s)</div>
            </div>
          </div>
        `;
      });

      list.innerHTML = html;
    }
  }
}

// ==========================================================================
// 13. MODAL CONTROLLERS & FORM VALIDATION HELPERS
// ==========================================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  AppState.activeModal = modalId;

  // Trap focus or focus on first input
  const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 60);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  AppState.activeModal = null;
}

function openConfirmModal({ title, message, submessage, confirmBtnText = 'Confirm', onConfirm }) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');
  const subEl = document.getElementById('confirmModalSubmessage');
  const actionBtn = document.getElementById('confirmModalActionBtn');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (subEl) subEl.textContent = submessage || '';
  if (actionBtn) {
    actionBtn.textContent = confirmBtnText;
    actionBtn.onclick = () => {
      closeModal('confirmModal');
      if (typeof onConfirm === 'function') onConfirm();
    };
  }

  openModal('confirmModal');
}

function setFormError(elementId, errorMessage) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = errorMessage;
}

function clearFormErrors(formPrefix) {
  document.querySelectorAll(`[id^="${formPrefix}"][id$="Error"]`).forEach(el => {
    el.textContent = '';
  });
}

// ==========================================================================
// 14. EVENT LISTENERS INITIALIZATION
// ==========================================================================
function setupEventListeners() {
  // 1. Sidebar Nav View Switchers
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const view = link.dataset.view;
      if (view) navigateTo(view);
    });
  });

  // Mobile sidebar drawer
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebar = document.getElementById('sidebar');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  // 2. Quick Action Buttons
  const sidebarNewProjectBtn = document.getElementById('sidebarNewProjectBtn');
  const sidebarNewTaskBtn = document.getElementById('sidebarNewTaskBtn');
  const dashNewProjectBtn = document.getElementById('dashNewProjectBtn');
  const openNewProjectModalBtn = document.getElementById('openNewProjectModalBtn');
  const openNewTaskModalBtn = document.getElementById('openNewTaskModalBtn');
  const openNewMemberModalBtn = document.getElementById('openNewMemberModalBtn');
  const emptyCreateProjectBtn = document.getElementById('emptyCreateProjectBtn');
  const emptyCreateProjectBtn2 = document.getElementById('emptyCreateProjectBtn2');
  const emptyCreateTaskBtn = document.getElementById('emptyCreateTaskBtn');
  const emptyAddMemberBtn = document.getElementById('emptyAddMemberBtn');

  if (sidebarNewProjectBtn) sidebarNewProjectBtn.addEventListener('click', openCreateProjectModal);
  if (sidebarNewTaskBtn) sidebarNewTaskBtn.addEventListener('click', () => openCreateTaskModal());
  if (dashNewProjectBtn) dashNewProjectBtn.addEventListener('click', openCreateProjectModal);
  if (openNewProjectModalBtn) openNewProjectModalBtn.addEventListener('click', openCreateProjectModal);
  if (openNewTaskModalBtn) openNewTaskModalBtn.addEventListener('click', () => openCreateTaskModal());
  if (openNewMemberModalBtn) openNewMemberModalBtn.addEventListener('click', openCreateMemberModal);
  if (emptyCreateProjectBtn) emptyCreateProjectBtn.addEventListener('click', openCreateProjectModal);
  if (emptyCreateProjectBtn2) emptyCreateProjectBtn2.addEventListener('click', openCreateProjectModal);
  if (emptyCreateTaskBtn) emptyCreateTaskBtn.addEventListener('click', () => openCreateTaskModal());
  if (emptyAddMemberBtn) emptyAddMemberBtn.addEventListener('click', openCreateMemberModal);

  // Quick jump buttons on dashboard
  const viewAllProjectsBtn = document.getElementById('viewAllProjectsBtn');
  const viewAllTasksBtn = document.getElementById('viewAllTasksBtn');
  const viewAllTeamBtn = document.getElementById('viewAllTeamBtn');

  if (viewAllProjectsBtn) viewAllProjectsBtn.addEventListener('click', () => navigateTo('projects'));
  if (viewAllTasksBtn) viewAllTasksBtn.addEventListener('click', () => navigateTo('tasks'));
  if (viewAllTeamBtn) viewAllTeamBtn.addEventListener('click', () => navigateTo('team'));

  // Quick column add buttons on kanban
  document.querySelectorAll('[data-quick-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.quickAdd;
      openCreateTaskModal('', status);
    });
  });

  // 3. Sample Data Buttons
  const dashSampleDataBtn = document.getElementById('dashSampleDataBtn');
  const emptyLoadSampleBtn = document.getElementById('emptyLoadSampleBtn');
  const menuLoadSample = document.getElementById('menuLoadSample');
  const settingsLoadSampleBtn = document.getElementById('settingsLoadSampleBtn');

  const triggerSampleData = async () => {
    try {
      await loadRealisticSampleData();
      showToast('Sample internship project data successfully loaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error populating sample data.', 'error');
    }
  };

  if (dashSampleDataBtn) dashSampleDataBtn.addEventListener('click', triggerSampleData);
  if (emptyLoadSampleBtn) emptyLoadSampleBtn.addEventListener('click', triggerSampleData);
  if (menuLoadSample) menuLoadSample.addEventListener('click', triggerSampleData);
  if (settingsLoadSampleBtn) settingsLoadSampleBtn.addEventListener('click', triggerSampleData);

  // 4. Data Wipe Buttons
  const menuResetData = document.getElementById('menuResetData');
  const settingsClearAllBtn = document.getElementById('settingsClearAllBtn');

  if (menuResetData) menuResetData.addEventListener('click', promptClearAllData);
  if (settingsClearAllBtn) settingsClearAllBtn.addEventListener('click', promptClearAllData);

  // 5. Global Search Input
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalSearchClear = document.getElementById('globalSearchClear');
  const closeSearchPopover = document.getElementById('closeSearchPopover');

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => handleGlobalSearch(e.target.value));
  }
  if (globalSearchClear) {
    globalSearchClear.addEventListener('click', () => {
      globalSearchInput.value = '';
      handleGlobalSearch('');
    });
  }
  if (closeSearchPopover) {
    closeSearchPopover.addEventListener('click', () => {
      const popover = document.getElementById('searchResultsPopover');
      if (popover) popover.classList.add('hidden');
    });
  }

  // 6. Topbar Menus (Notifications & Profile)
  const notificationsBtn = document.getElementById('notificationsBtn');
  const notificationsMenu = document.getElementById('notificationsMenu');
  const dismissAllNotifications = document.getElementById('dismissAllNotifications');

  if (notificationsBtn && notificationsMenu) {
    notificationsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationsMenu.classList.toggle('hidden');
      const profileMenu = document.getElementById('profileMenu');
      if (profileMenu) profileMenu.classList.add('hidden');
    });
  }

  if (dismissAllNotifications) {
    dismissAllNotifications.addEventListener('click', () => {
      if (notificationsMenu) notificationsMenu.classList.add('hidden');
      showToast('Notifications cleared for this session.', 'info', 2000);
    });
  }

  const userProfileBtn = document.getElementById('userProfileBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (userProfileBtn && profileMenu) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
      if (notificationsMenu) notificationsMenu.classList.add('hidden');
    });
  }

  const menuGoSettings = document.getElementById('menuGoSettings');
  if (menuGoSettings) {
    menuGoSettings.addEventListener('click', () => {
      if (profileMenu) profileMenu.classList.add('hidden');
      navigateTo('settings');
    });
  }

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (notificationsMenu && !notificationsMenu.contains(e.target) && e.target !== notificationsBtn) {
      notificationsMenu.classList.add('hidden');
    }
    if (profileMenu && !profileMenu.contains(e.target) && e.target !== userProfileBtn) {
      profileMenu.classList.add('hidden');
    }
    const popover = document.getElementById('searchResultsPopover');
    if (popover && !popover.contains(e.target) && e.target !== globalSearchInput) {
      popover.classList.add('hidden');
    }
  });

  // 7. Theme Toggle Quick Button
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = AppState.settings.theme === 'dark' ? 'light' : 'dark';
      handleThemeChange(nextTheme);
    });
  }

  // 8. Settings Theme Radio Choice
  document.querySelectorAll('input[name="appTheme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      handleThemeChange(e.target.value);
    });
  });

  // 9. Forms Submissions
  const projectForm = document.getElementById('projectForm');
  const taskForm = document.getElementById('taskForm');
  const memberForm = document.getElementById('memberForm');
  const settingsProfileForm = document.getElementById('settingsProfileForm');
  const addCommentForm = document.getElementById('addCommentForm');

  if (projectForm) projectForm.addEventListener('submit', handleProjectFormSubmit);
  if (taskForm) taskForm.addEventListener('submit', handleTaskFormSubmit);
  if (memberForm) memberForm.addEventListener('submit', handleMemberFormSubmit);
  if (settingsProfileForm) settingsProfileForm.addEventListener('submit', handleProfileSettingsSubmit);
  if (addCommentForm) addCommentForm.addEventListener('submit', handleCommentFormSubmit);

  // 10. Modals Close Handlers (via data-close-modal & Esc key)
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.closeModal;
      if (modalId) closeModal(modalId);
    });
  });

  // Close modal when clicking on dark backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        AppState.activeModal = null;
      }
    });
  });

  // Global ESC Key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (AppState.activeModal) {
        closeModal(AppState.activeModal);
      }
      const popover = document.getElementById('searchResultsPopover');
      if (popover) popover.classList.add('hidden');
      if (notificationsMenu) notificationsMenu.classList.add('hidden');
      if (profileMenu) profileMenu.classList.add('hidden');
    }
  });

  // 11. Project View Filters & Sorting
  const projectSearchInput = document.getElementById('projectSearchInput');
  const projectSortSelect = document.getElementById('projectSortSelect');
  const clearProjectFiltersBtn = document.getElementById('clearProjectFiltersBtn');

  if (projectSearchInput) {
    projectSearchInput.addEventListener('input', (e) => {
      AppState.filters.projectSearch = e.target.value;
      renderProjects();
    });
  }
  if (projectSortSelect) {
    projectSortSelect.addEventListener('change', (e) => {
      AppState.filters.projectSort = e.target.value;
      renderProjects();
    });
  }
  if (clearProjectFiltersBtn) {
    clearProjectFiltersBtn.addEventListener('click', () => {
      AppState.filters.projectSearch = '';
      AppState.filters.projectSort = 'newest';
      if (projectSearchInput) projectSearchInput.value = '';
      if (projectSortSelect) projectSortSelect.value = 'newest';
      renderProjects();
    });
  }

  // 12. Task View Filter Controls
  const taskSearchInput = document.getElementById('taskSearchInput');
  const taskFilterProject = document.getElementById('taskFilterProject');
  const taskFilterPriority = document.getElementById('taskFilterPriority');
  const taskFilterAssignee = document.getElementById('taskFilterAssignee');
  const taskFilterStatus = document.getElementById('taskFilterStatus');
  const clearTaskFiltersBtn = document.getElementById('clearTaskFiltersBtn');

  if (taskSearchInput) {
    taskSearchInput.addEventListener('input', (e) => {
      AppState.filters.taskSearch = e.target.value;
      renderTasks();
    });
  }
  if (taskFilterProject) {
    taskFilterProject.addEventListener('change', (e) => {
      AppState.filters.taskProject = e.target.value;
      renderTasks();
    });
  }
  if (taskFilterPriority) {
    taskFilterPriority.addEventListener('change', (e) => {
      AppState.filters.taskPriority = e.target.value;
      renderTasks();
    });
  }
  if (taskFilterAssignee) {
    taskFilterAssignee.addEventListener('change', (e) => {
      AppState.filters.taskAssignee = e.target.value;
      renderTasks();
    });
  }
  if (taskFilterStatus) {
    taskFilterStatus.addEventListener('change', (e) => {
      AppState.filters.taskStatus = e.target.value;
      renderTasks();
    });
  }
  if (clearTaskFiltersBtn) {
    clearTaskFiltersBtn.addEventListener('click', clearAllTaskFilters);
  }

  // 13. Kanban vs List View Mode Toggle
  const taskViewKanbanBtn = document.getElementById('taskViewKanbanBtn');
  const taskViewListBtn = document.getElementById('taskViewListBtn');

  if (taskViewKanbanBtn) {
    taskViewKanbanBtn.addEventListener('click', () => {
      AppState.taskViewMode = 'kanban';
      taskViewKanbanBtn.classList.add('active');
      if (taskViewListBtn) taskViewListBtn.classList.remove('active');
      renderTasks();
    });
  }

  if (taskViewListBtn) {
    taskViewListBtn.addEventListener('click', () => {
      AppState.taskViewMode = 'list';
      taskViewListBtn.classList.add('active');
      if (taskViewKanbanBtn) taskViewKanbanBtn.classList.remove('active');
      renderTasks();
    });
  }

  // 14. Team Member Search
  const memberSearchInput = document.getElementById('memberSearchInput');
  const clearMemberFiltersBtn = document.getElementById('clearMemberFiltersBtn');

  if (memberSearchInput) {
    memberSearchInput.addEventListener('input', (e) => {
      AppState.filters.memberSearch = e.target.value;
      renderTeam();
    });
  }
  if (clearMemberFiltersBtn) {
    clearMemberFiltersBtn.addEventListener('click', () => {
      AppState.filters.memberSearch = '';
      if (memberSearchInput) memberSearchInput.value = '';
      renderTeam();
    });
  }
}

// ==========================================================================
// 15. Application Bootstrapper
// ==========================================================================
async function initApp() {
  try {
    // 1. Initialize IndexedDB
    await db.init();

    // 2. Setup DOM event listeners
    setupEventListeners();

    // 3. Load initial data
    await loadAllDataFromDB();

    // 4. Default to Dashboard
    navigateTo('dashboard');

    console.log('TaskFlow initialized successfully. IndexedDB storage ready.');
  } catch (err) {
    console.error('Fatal initialization error:', err);
    const healthIndicator = document.getElementById('dbHealthIndicator');
    if (healthIndicator) {
      healthIndicator.textContent = '✕ Storage Error: Unavailable';
      healthIndicator.className = 'db-stat-value text-danger font-bold';
    }
    showToast(`Browser storage initialization error: ${err.message}`, 'error', 8000);
  }
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
