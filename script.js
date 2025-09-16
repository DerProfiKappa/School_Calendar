// Prevent iPad zooming
document.addEventListener('touchmove', function(event) {
  if(event.scale !== 1) { event.preventDefault(); }
}, { passive: false });
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });

// THEME MANAGEMENT
const themeSelect = document.getElementById('themeSelect');
const accentColorPicker = document.getElementById('accentColor');

// Load theme from storage
function applyTheme(theme, accent) {
  document.documentElement.setAttribute('data-theme', theme || 'system');
  if (theme === 'custom' && accent) {
    document.documentElement.style.setProperty('--custom-accent', accent);
    accentColorPicker.value = accent;
    accentColorPicker.style.display = '';
  } else {
    document.documentElement.style.removeProperty('--custom-accent');
    accentColorPicker.style.display = theme === 'custom' ? '' : 'none';
  }
}

// Apply preferred theme on load
let savedTheme = localStorage.getItem('calendarTheme') || 'system';
let customAccent = localStorage.getItem('calendarAccent') || '#007aff';
applyTheme(savedTheme, customAccent);
themeSelect.value = savedTheme;

// Handle theme change
themeSelect.onchange = function() {
  if (themeSelect.value === 'custom') {
    accentColorPicker.style.display = '';
  } else {
    accentColorPicker.style.display = 'none';
  }
  localStorage.setItem('calendarTheme', themeSelect.value);
  applyTheme(themeSelect.value, accentColorPicker.value);
};

accentColorPicker.oninput = function() {
  document.documentElement.style.setProperty('--custom-accent', accentColorPicker.value);
  localStorage.setItem('calendarAccent', accentColorPicker.value);
  applyTheme('custom', accentColorPicker.value);
};

class StudyCalendar {
  constructor() {
    this.currentDate = new Date();
    this.events = JSON.parse(localStorage.getItem('studyEvents')) || [];
    this.init();

    // Touch swipe scroll for iPad-like navigation
    this.scrollStartX = 0;
    this.scrolling = false;
    this.attachSwipeHandlers();
  }

  init() {
    this.renderCalendar();
    this.renderUpcoming();
    this.bindEvents();
    this.requestNotificationPermission();
    this.scheduleNotifications();
  }

  attachSwipeHandlers() {
    const calScroll = document.getElementById('calendarScroll');
    let startX = null;

    calScroll.addEventListener('touchstart', (e) => {
      startX = e.touches[0].pageX;
    }, { passive: true });
    calScroll.addEventListener('touchend', (e) => {
      if (!startX) return;
      let endX = e.changedTouches[0].pageX;
      let diff = endX - startX;
      if (Math.abs(diff) > 50) {
        if (diff < 0) this.nextMonth();
        else this.previousMonth();
        startX = null;
      }
    }, { passive: true });
    // Mouse drag for desktop
    let dragging = false, beginX;
    calScroll.addEventListener('mousedown', e => { dragging = true; beginX = e.pageX; });
    window.addEventListener('mouseup', () => { dragging = false; });
    calScroll.addEventListener('mousemove', e => {
      if (dragging) {
        let diff = e.pageX - beginX;
        if (Math.abs(diff) > 70) {
          if (diff < 0) this.nextMonth();
          else this.previousMonth();
          dragging = false;
        }
      }
    });
  }

  bindEvents() {
    document.getElementById('addBtn').onclick = () => this.openModal();
    document.getElementById('closeBtn').onclick = () => this.closeModal();
    document.getElementById('cancelBtn').onclick = () => this.closeModal();
    document.getElementById('eventForm').onsubmit = (e) => this.handleFormSubmit(e);
    document.getElementById('prevBtn').onclick = () => this.previousMonth();
    document.getElementById('nextBtn').onclick = () => this.nextMonth();
    document.getElementById('modal').onclick = (e) => {
      if (e.target.id === 'modal') this.closeModal();
    };
  }

  renderCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    document.getElementById('monthYear').textContent =
      new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.currentDate);

    // Day headers
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dayHeaders.forEach(day => {
      const dh = document.createElement('div');
      dh.className = 'day-header';
      dh.textContent = day;
      calendarGrid.appendChild(dh);
    });

    // Prev month days (greyed)
    for(let i=firstDay-1;i>=0;i--) {
      calendarGrid.appendChild(this.createDayCell(daysInPrevMonth-i, true));
    }
    // Current month days
    for(let day=1; day<=daysInMonth; day++) {
      calendarGrid.appendChild(this.createDayCell(day, false));
    }
    // Next month days
    const totalCells = calendarGrid.children.length-7, remainingCells = 42-totalCells;
    for(let day=1; day<=remainingCells; day++) {
      calendarGrid.appendChild(this.createDayCell(day, true));
    }
  }

  createDayCell(day, otherMonth) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell';
    dayCell.textContent = day;

    const today = new Date();
    let cellDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() +
      (otherMonth ? (day<15 ? 1 : -1) : 0), day);
    if(cellDate.toDateString()===today.toDateString()) {
      dayCell.classList.add('today');
    }
    const dateString = cellDate.toISOString().split('T')[0];
    if(this.events.some(ev => ev.date === dateString)) {
      dayCell.classList.add('has-events');
    }
    if(otherMonth) dayCell.classList.add('other-month');
    dayCell.onclick = () => {
      document.getElementById('eventDate').value = dateString;
      this.openModal();
    };
    return dayCell;
  }

  previousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth()-1);
    this.renderCalendar();
  }
  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth()+1);
    this.renderCalendar();
  }

  openModal() {
    document.getElementById('modal').classList.add('show');
    document.getElementById('eventTitle').focus();
  }
  closeModal() {
    document.getElementById('modal').classList.remove('show');
    document.getElementById('eventForm').reset();
  }
  handleFormSubmit(e) {
    e.preventDefault();
    const event = {
      id: Date.now(),
      title: document.getElementById('eventTitle').value,
      type: document.getElementById('eventType').value,
      date: document.getElementById('eventDate').value,
      time: document.getElementById('eventTime').value,
      notes: document.getElementById('eventNotes').value
    };
    this.events.push(event); this.saveEvents();
    this.renderCalendar();
    this.renderUpcoming();
    this.scheduleNotifications();
    this.closeModal();
  }
  saveEvents() {
    localStorage.setItem('studyEvents', JSON.stringify(this.events));
  }
  renderUpcoming() {
    const upcomingList = document.getElementById('upcomingList');
    const today = new Date();
    const upcoming = this.events
      .filter(event => new Date(event.date + 'T' + event.time) >= today)
      .sort((a, b) =>
        new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
      .slice(0, 5);
    if (upcoming.length === 0) {
      upcomingList.innerHTML = '<p>No upcoming events</p>';
      return;
    }
    upcomingList.innerHTML = upcoming.map(event => `
      <div class="event-item ${event.type}">
        <div class="event-details">
          <div class="event-title">${event.title}</div>
          <div class="event-date-time">
            ${event.date} at ${event.time}
          </div>
        </div>
        <span class="event-type">${event.type}</span>
      </div>
    `).join('');
  }

  // (Simple Notification Setup; iPad Safari support limited)
  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  scheduleNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // ToDo: Implement notification scheduling logic if supported on platform
  }
}

// Prevent pinch-zoom again
document.addEventListener('touchstart', function(event){
  if(event.touches.length > 1){
    event.preventDefault();
  }}, { passive: false });

window.onload = () => {
  new StudyCalendar();
};
