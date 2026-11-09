# 🚀 TASKFLOW — Smart Project Management Tool

**TaskFlow** is a modern, lightweight, full-featured project and task management web application built entirely using **vanilla HTML5, CSS3, and JavaScript**, powered by the browser-native **IndexedDB API** for 100% offline-ready, serverless client-side persistence.

Designed with executive UI aesthetics, high-contrast typography, and intuitive UX patterns, TaskFlow is **internship-ready** and engineered specifically for hassle-free hosting on **GitHub Pages** with zero build steps, zero node_modules, and zero backend configuration.

---

## 🌟 Key Features

### 1. Executive Dashboard & Live Analytics
- **Dynamic Metrics Engine**: Calculates Total Projects, Total Tasks, Completed Tasks, Tasks In Progress, Pending (Backlog) Tasks, and Completion Percentage in real-time from stored records.
- **Deadlines Watch**: Automatically flags upcoming deadlines within the next 7 days and displays overdue warnings with day counters.
- **Progress Milestones**: Real-time progress bars for active projects calculated from task completions.
- **Recent Activity Streams**: Instant overview of latest task updates and team assignments.
- **Helpful Empty States**: Clean onboarding state when no projects exist, with a single-click "Load Demo Data" button.

### 2. Complete Project Portfolio Management (CRUD)
- **Create Projects**: Title, rich description, lead/owner name, target completion date, and multi-member team assignment.
- **Project Details View**: Modal showcasing overall progress %, contributor avatars, metadata, and associated tasks table with direct quick-action links.
- **Edit & Update**: Real-time updating of project deliverables and team contributors.
- **Cascading Deletion Safeguard**: Deleting a project safely purges all associated tasks and comments to prevent orphaned database records, backed by a confirmation dialog.
- **Search & Sort**: Filter projects by title, description, or owner, with sorting by Newest, Oldest, Title (A-Z), and Progress %.

### 3. Interactive Kanban Board & Task Management (CRUD)
- **3-Column Kanban Board**: *To Do*, *In Progress*, and *Completed*.
- **Native HTML5 Drag-and-Drop**: Drag task cards between columns with visual drop target highlights. Status updates persist directly to IndexedDB and refresh dashboard analytics automatically.
- **Accessible Alternative Control**: Every task card includes a quick-select dropdown so keyboard or mobile users can update statuses without drag-and-drop.
- **List View Toggle**: Switch effortlessly between the visual Kanban Board and a compact Table List view.
- **Priority & Overdue Badging**: Color-coded badges for *Low*, *Medium*, and *High* priorities, plus urgent overdue flags (`⚠️ Overdue`).
- **Multi-Factor Filtering**: Filter tasks simultaneously by Search Query, Project, Priority, Assignee, and Status, with removable filter chips and a "Clear Filters" button.

### 4. Local Team Directory
- **Team Management**: Add and edit contributors with Full Name, validated Email address, and Role/Specialization.
- **Safe Deletion Guard**: Prevents accidental deletion of team members who currently have assigned tasks, advising reassignment first.
- **Workload Indicator**: Shows total assigned tasks and completed tasks per team member.

### 5. Task Activity & Discussion Threads (Comments)
- **Persistent Comments Feed**: Add timestamped comments, progress notes, and questions to any task.
- **Author Attribution**: Uses the current display name or any team member's identity.
- **Storage Association**: Comments are indexed by `taskId` in IndexedDB and removed if the task is deleted.

### 6. Settings & Data Control
- **User Profile Personalization**: Customize your display name and role.
- **Theme Switcher**: Instant toggle between Clean Light Theme and modern Dark Slate Theme (stored in IndexedDB).
- **Storage Inspector**: Live counter showing record counts in IndexedDB (`projects`, `tasks`, `members`, `comments`).
- **1-Click Sample Data Generator**: Pre-populates 3 realistic projects, diverse tasks in all columns, team members, and comments to demonstrate the app immediately.
- **Clear All Data**: Reset button with a double-confirmation modal.

---

## 🛠️ Technology Stack & Architecture

- **Structure**: HTML5 (Semantic elements, accessible ARIA attributes, modal focus management)
- **Styling**: CSS3 (Modern custom properties/variables, responsive CSS Grid, Flexbox, glassmorphism hints)
- **Icons**: Crisp inline SVG iconography (zero external fonts or network dependencies)
- **Logic**: Vanilla ECMAScript (ES6+ classes, async/await, native drag-and-drop event pipeline)
- **Storage**: Browser HTML5 IndexedDB API (`TaskFlowDB` v1 with object stores and indexes)
- **Dependencies**: **Zero** external libraries or build tools.

### IndexedDB Schema Overview

```
Database: TaskFlowDB (Version 1)
│
├── projects (keyPath: 'id')
│   ├── Index: title
│   └── Index: createdAt
│
├── tasks (keyPath: 'id')
│   ├── Index: projectId
│   ├── Index: status
│   ├── Index: priority
│   ├── Index: assignedTo
│   └── Index: dueDate
│
├── members (keyPath: 'id')
│   ├── Index: email (unique)
│   └── Index: name
│
├── comments (keyPath: 'id')
│   ├── Index: taskId
│   └── Index: createdAt
│
└── settings (keyPath: 'key')
```

---

## 💻 How to Run Locally (No Terminal Required)

Because TaskFlow is built with standard web technologies, you do **not** need Node.js, npm, Python, or terminal commands to run it.

1. Locate the folder where TaskFlow is saved (e.g., `Desktop\taskflow`).
2. Double-click the file named **`index.html`**.
3. It will open directly in Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari.
4. Click **"Explore with Sample Data"** on the dashboard to immediately test all features!

---

## 🌐 How to Deploy to GitHub Pages (Without Terminal Commands)

You can publish TaskFlow live on the internet using GitHub's website in less than 3 minutes:

### Step 1: Create a New GitHub Repository
1. Open your web browser and go to [github.com](https://github.com).
2. Log in to your GitHub account (or sign up for free).
3. Click the **"+"** icon in the top right corner and select **"New repository"**.
4. Set the **Repository name** to: `taskflow` (or any name you like).
5. Choose **Public**.
6. Leave "Add a README file" **unchecked** (we already created one).
7. Click the green **"Create repository"** button.

### Step 2: Upload Files Through the GitHub Website
1. On the new repository page, click the link that says **"uploading an existing file"** (located under *“Get started by creating a new file or uploading an existing file”*).
2. Open your computer's file explorer to the `taskflow` folder:
   - Select all files in this folder:
     - `index.html`
     - `style.css`
     - `script.js`
     - `README.md`
3. Drag and drop these files into the box on the GitHub webpage.
4. Scroll to the bottom of the page to **Commit changes**.
5. Keep "Commit directly to the `main` branch" selected.
6. Click the green **"Commit changes"** button.

### Step 3: Enable GitHub Pages
1. In your GitHub repository, click the **"Settings"** tab (gear icon at the top).
2. In the left sidebar, click on **"Pages"** (under the "Code and automation" section).
3. Under **"Build and deployment"** > **"Source"**, make sure **"Deploy from a branch"** is selected.
4. Under **"Branch"**:
   - Change `None` to **`main`**.
   - Leave the folder set to **`/(root)`**.
5. Click **"Save"**.

### Step 4: Access Your Live Website
1. Wait 1 to 2 minutes for GitHub to finish building the site.
2. Refresh the **Pages** settings page.
3. At the top, you will see a banner saying:
   > **"Your site is live at https://<your-username>.github.io/taskflow/"**
4. Click **"Visit site"** to see your live, hosted TaskFlow application!

---

## ⚠️ Honest List of Limitations

To maintain absolute transparency for college reviews and internship assessments:

1. **Single-Browser Local Demonstration**: Data is stored inside the client browser's **IndexedDB**. It does not synchronize across different computers, browsers, or mobile devices unless exported or connected to an external cloud database.
2. **Local Contributor Records**: Team members are mock profiles used for assignment tagging and workload distribution; there is no remote user authentication, password login, or real-time multi-user WebSocket editing.
3. **Demo Notifications**: The notification bell alerts users to upcoming and overdue deadlines derived locally from stored tasks. It does not push OS-level system notifications or dispatch emails.
4. **Browser Site Data Clearing**: If you clear your browser's "Cookies and other site data" for the site, the local IndexedDB database will be cleared. You can click "Load Sample Data" at any time to restore a demo environment.

---

## 📁 Project File Structure

```
taskflow/
├── index.html        # Semantic HTML5 shell, navigation, modals, and templates
├── style.css         # Modern design system, themes, CSS grid, kanban styles
├── script.js         # IndexedDB database manager, drag-and-drop, CRUD logic
└── README.md         # Comprehensive project documentation & deployment guide
```

---

## 🏆 College Internship Highlights

- Demonstrates mastery of the asynchronous **IndexedDB API** with custom Promise abstractions.
- Clean separation of UI rendering logic from data storage operations.
- Compliant with **WCAG AA** accessibility principles (semantic headings, ARIA attributes, keyboard support).
- Responsive layout across desktop, tablet, and mobile breakpoints with collapsible drawer navigation.
- Native HTML5 Drag-and-Drop API with fallback status dropdowns for assistive technology.
