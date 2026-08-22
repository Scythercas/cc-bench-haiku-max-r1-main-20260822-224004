// タスク管理アプリ

var app = (function() {
  var STORAGE_KEY = 'tasks-app';
  var tasks = [];
  var currentFilter = 'all'; // all, active, completed
  var currentSort = 'created'; // created, due, priority

  // DOM要素の取得
  function getDOMElements() {
    return {
      taskInput: document.getElementById('taskInput'),
      dueInput: document.getElementById('dueInput'),
      prioritySelect: document.getElementById('prioritySelect'),
      addButton: document.getElementById('addButton'),
      taskList: document.getElementById('taskList'),
      filterAll: document.getElementById('filterAll'),
      filterActive: document.getElementById('filterActive'),
      filterCompleted: document.getElementById('filterCompleted'),
      sortSelect: document.getElementById('sortSelect'),
      remainingCount: document.querySelector('[data-testid="remaining-count"]'),
      clearCompleted: document.getElementById('clearCompleted')
    };
  }

  // 初期化
  function init() {
    loadTasks();
    attachEventListeners();
    render();
  }

  // イベントリスナー登録
  function attachEventListeners() {
    var dom = getDOMElements();

    // 追加ボタン
    dom.addButton.addEventListener('click', function() {
      addTask();
    });

    // Enterキーで追加
    dom.taskInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addTask();
      }
    });

    // 絞り込みボタン
    dom.filterAll.addEventListener('click', function() {
      setFilter('all');
    });
    dom.filterActive.addEventListener('click', function() {
      setFilter('active');
    });
    dom.filterCompleted.addEventListener('click', function() {
      setFilter('completed');
    });

    // 並べ替え
    dom.sortSelect.addEventListener('change', function(e) {
      setSort(e.target.value);
    });

    // 完了済み削除
    dom.clearCompleted.addEventListener('click', function() {
      clearCompletedTasks();
    });
  }

  // タスク追加
  function addTask() {
    var dom = getDOMElements();
    var title = dom.taskInput.value.trim();

    // タイトルが空白のみの場合は追加しない
    if (!title) {
      return;
    }

    var task = {
      id: generateId(),
      title: title,
      completed: false,
      due: dom.dueInput.value || null,
      priority: dom.prioritySelect.value
    };

    tasks.push(task);
    saveTasks();

    // 入力欄をリセット
    dom.taskInput.value = '';
    dom.dueInput.value = '';
    dom.prioritySelect.value = 'medium';
    dom.taskInput.focus();

    render();
  }

  // タスク削除
  function deleteTask(id) {
    tasks = tasks.filter(function(task) {
      return task.id !== id;
    });
    saveTasks();
    render();
  }

  // タスク完了状態トグル
  function toggleTask(id) {
    var task = findTask(id);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      render();
    }
  }

  // タスク編集
  function editTask(id) {
    var task = findTask(id);
    if (!task) return;

    // 編集モードに切り替え
    var taskItem = document.querySelector('[data-task-id="' + id + '"]');
    taskItem.classList.add('edit-mode');

    // 入力欄にフォーカス
    var input = taskItem.querySelector('.edit-title-input');
    input.focus();
    input.select();
  }

  // タスク更新（編集確定）
  function updateTask(id, newTitle, newDue, newPriority) {
    var task = findTask(id);
    if (!task) return;

    newTitle = newTitle.trim();
    if (!newTitle) {
      return; // タイトルが空の場合は更新しない
    }

    task.title = newTitle;
    task.due = newDue || null;
    task.priority = newPriority;
    saveTasks();
    render();
  }

  // 編集キャンセル
  function cancelEdit(id) {
    var taskItem = document.querySelector('[data-task-id="' + id + '"]');
    if (taskItem) {
      taskItem.classList.remove('edit-mode');
    }
  }

  // 完了済みタスク一括削除
  function clearCompletedTasks() {
    tasks = tasks.filter(function(task) {
      return !task.completed;
    });
    saveTasks();
    render();
  }

  // 絞り込み設定
  function setFilter(filter) {
    currentFilter = filter;
    updateFilterButtons();
    render();
  }

  // 並べ替え設定
  function setSort(sort) {
    currentSort = sort;
    render();
  }

  // フィルター処理
  function getFilteredTasks() {
    var filtered = tasks;

    // 絞り込み
    if (currentFilter === 'active') {
      filtered = filtered.filter(function(task) {
        return !task.completed;
      });
    } else if (currentFilter === 'completed') {
      filtered = filtered.filter(function(task) {
        return task.completed;
      });
    }

    return filtered;
  }

  // ソート処理
  function getSortedTasks(taskList) {
    var sorted = taskList.slice();

    if (currentSort === 'due') {
      sorted.sort(function(a, b) {
        // 期限がない場合は最後に
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
      });
    } else if (currentSort === 'priority') {
      var priorityOrder = { high: 0, medium: 1, low: 2 };
      sorted.sort(function(a, b) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }
    // created: 元の順序のまま

    return sorted;
  }

  // レンダリング
  function render() {
    var dom = getDOMElements();
    var filtered = getFilteredTasks();
    var sorted = getSortedTasks(filtered);

    // タスク一覧をレンダリング
    if (sorted.length === 0) {
      dom.taskList.innerHTML = '<div class="empty-message">タスクがありません</div>';
    } else {
      dom.taskList.innerHTML = '';
      sorted.forEach(function(task) {
        dom.taskList.appendChild(createTaskElement(task));
      });
    }

    // 残り件数を更新
    var activeCount = tasks.filter(function(task) {
      return !task.completed;
    }).length;
    dom.remainingCount.textContent = '残り ' + activeCount + ' 件';

    // フィルターボタンを更新
    updateFilterButtons();
  }

  // タスク要素生成
  function createTaskElement(task) {
    var li = document.createElement('div');
    li.className = 'task-item';
    li.setAttribute('data-testid', 'task-item');
    li.setAttribute('data-task-id', task.id);
    li.role = 'listitem';

    if (task.completed) {
      li.classList.add('completed');
    }

    // チェックボックス
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('data-testid', 'toggle');
    checkbox.setAttribute('aria-label', 'タスク「' + task.title + '」の完了状態');
    checkbox.addEventListener('change', function() {
      toggleTask(task.id);
    });

    // コンテンツ
    var content = document.createElement('div');
    content.className = 'task-content';

    // タイトル + メタ情報
    var titleWrapper = document.createElement('div');
    titleWrapper.className = 'task-title-wrapper';

    var titleSpan = document.createElement('span');
    titleSpan.className = 'task-title';
    titleSpan.setAttribute('data-testid', 'task-title');
    titleSpan.textContent = task.title;

    titleWrapper.appendChild(titleSpan);
    content.appendChild(titleWrapper);

    // メタ情報（期限・優先度）
    var meta = document.createElement('div');
    meta.className = 'task-meta';

    if (task.due) {
      var dueSpan = document.createElement('span');
      dueSpan.className = 'task-due';
      dueSpan.textContent = '期限: ' + formatDate(task.due);
      meta.appendChild(dueSpan);
    }

    var prioritySpan = document.createElement('span');
    prioritySpan.className = 'task-priority ' + task.priority;
    prioritySpan.textContent = getPriorityLabel(task.priority);
    meta.appendChild(prioritySpan);

    content.appendChild(meta);

    // 編集モード用の入力欄
    var editWrapper = document.createElement('div');
    editWrapper.className = 'edit-input-wrapper';

    var editTitleInput = document.createElement('input');
    editTitleInput.type = 'text';
    editTitleInput.className = 'edit-title-input';
    editTitleInput.value = task.title;
    editTitleInput.setAttribute('aria-label', 'タイトル編集');

    var editDueInput = document.createElement('input');
    editDueInput.type = 'date';
    editDueInput.className = 'edit-due-input';
    editDueInput.value = task.due || '';
    editDueInput.setAttribute('aria-label', '期限日編集');

    var editPrioritySelect = document.createElement('select');
    editPrioritySelect.className = 'edit-priority-select';
    editPrioritySelect.setAttribute('aria-label', '優先度編集');

    var optLow = document.createElement('option');
    optLow.value = 'low';
    optLow.textContent = '低';
    var optMid = document.createElement('option');
    optMid.value = 'medium';
    optMid.textContent = '中';
    var optHigh = document.createElement('option');
    optHigh.value = 'high';
    optHigh.textContent = '高';
    editPrioritySelect.appendChild(optLow);
    editPrioritySelect.appendChild(optMid);
    editPrioritySelect.appendChild(optHigh);
    editPrioritySelect.value = task.priority;

    var saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.setAttribute('aria-label', 'タスクを保存');
    saveBtn.addEventListener('click', function() {
      updateTask(task.id, editTitleInput.value, editDueInput.value, editPrioritySelect.value);
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.setAttribute('aria-label', '編集をキャンセル');
    cancelBtn.addEventListener('click', function() {
      cancelEdit(task.id);
    });

    editWrapper.appendChild(editTitleInput);
    editWrapper.appendChild(editDueInput);
    editWrapper.appendChild(editPrioritySelect);
    editWrapper.appendChild(saveBtn);
    editWrapper.appendChild(cancelBtn);

    // ESCキーでキャンセル
    editTitleInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        cancelEdit(task.id);
      }
    });

    // Enterキーで保存
    editTitleInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        updateTask(task.id, editTitleInput.value, editDueInput.value, editPrioritySelect.value);
      }
    });

    content.appendChild(editWrapper);

    // ボタン
    var actions = document.createElement('div');
    actions.className = 'task-actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'task-btn edit';
    editBtn.textContent = '編集';
    editBtn.setAttribute('data-testid', 'edit');
    editBtn.setAttribute('aria-label', 'タスクを編集');
    editBtn.addEventListener('click', function() {
      editTask(task.id);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-btn delete';
    deleteBtn.textContent = '削除';
    deleteBtn.setAttribute('data-testid', 'delete');
    deleteBtn.setAttribute('aria-label', 'タスクを削除');
    deleteBtn.addEventListener('click', function() {
      deleteTask(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    // 組み立て
    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(actions);

    return li;
  }

  // フィルターボタン更新
  function updateFilterButtons() {
    var dom = getDOMElements();
    dom.filterAll.classList.toggle('active', currentFilter === 'all');
    dom.filterActive.classList.toggle('active', currentFilter === 'active');
    dom.filterCompleted.classList.toggle('active', currentFilter === 'completed');
  }

  // ユーティリティ

  function findTask(id) {
    return tasks.find(function(task) {
      return task.id === id;
    });
  }

  function generateId() {
    return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  function formatDate(dateStr) {
    var date = new Date(dateStr + 'T00:00:00');
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function getPriorityLabel(priority) {
    var labels = {
      high: '高',
      medium: '中',
      low: '低'
    };
    return labels[priority] || '中';
  }

  // ストレージ
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks to localStorage:', e);
    }
  }

  function loadTasks() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      tasks = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load tasks from localStorage:', e);
      tasks = [];
    }
  }

  // Polyfill: Array.prototype.find
  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      value: function(predicate) {
        for (var i = 0; i < this.length; i++) {
          if (predicate(this[i], i, this)) {
            return this[i];
          }
        }
        return undefined;
      }
    });
  }

  // 公開API
  return {
    init: init
  };
})();

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', function() {
  app.init();
});
