class StudyCalendar {
    constructor() {
        this.currentDate = new Date();
        this.events = JSON.parse(localStorage.getItem('studyEvents')) || [];
        this.init();
    }

    init() {
        this.renderCalendar();
        this.renderUpcoming();
        this.bindEvents();
        this.requestNotificationPermission();
        this.scheduleNotifications();
    }

    bindEvents() {
        document.getElementById('addBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('eventForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('prevBtn').addEventListener('click', () => this.previousMonth());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextMonth());
        
        // Close modal when clicking outside
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Update month/year display
        document.getElementById('monthYear').textContent = 
            new Intl.DateTimeFormat('en-US', { 
                month: 'long', 
                year: 'numeric' 
            }).format(this.currentDate);

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const calendarGrid = document.getElementById('calendarGrid');
        calendarGrid.innerHTML = '';

        // Day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });

        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayCell = this.createDayCell(daysInPrevMonth - i, true);
            calendarGrid.appendChild(dayCell);
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = this.createDayCell(day, false);
            calendarGrid.appendChild(dayCell);
        }

        // Next month days
        const totalCells = calendarGrid.children.length - 7; // Subtract day headers
        const remainingCells = 42 - totalCells; // 6 rows × 7 days
        for (let day = 1; day <= remainingCells; day++) {
            const dayCell = this.createDayCell(day, true);
            calendarGrid.appendChild(dayCell);
        }
    }

    createDayCell(day, otherMonth) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.textContent = day;
        
        if (otherMonth) {
            dayCell.classList.add('other-month');
        }

        // Check if this is today
        const today = new Date();
        const cellDate = new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth() + (otherMonth ? (day < 15 ? 1 : -1) : 0),
            day
        );
        
        if (cellDate.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }

        // Check for events on this date
        const dateString = cellDate.toISOString().split('T')[0];
        const hasEvents = this.events.some(event => event.date === dateString);
        
        if (hasEvents) {
            dayCell.classList.add('has-events');
        }

        // Add click handler
        dayCell.addEventListener('click', () => {
            document.getElementById('eventDate').value = dateString;
            this.openModal();
        });

        return dayCell;
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
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

        this.events.push(event);
        this.saveEvents();
        this.renderCalendar();
        this.renderUpcoming();
        this.scheduleNotifications();
        this.closeModal();
    }

    renderUpcoming() {
        const upcomingList = document.getElementById('upcomingList');
        const today = new Date();
        const upcoming = this.events
            .filter(event => new Date(event.date + 'T' + event.time) >= today)
            .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
            .slice(0, 5);

        if (upcoming.length === 0) {
            upcomingList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No upcoming events</p>';
            return;
        }

        upcomingList.innerHTML = upcoming.map(event => `
            <div class="event-item ${event.type}">
                <div class="event-details">
                    <div class="event-title">${event.title}</div>
                    <div class="event-date-time">
                        ${new Date(event.date).toLocaleDateString()} at ${event.time}
                    </div>
                </div>
                <span class="event-type">${event.type}</span>
            </div>
        `).join('');
    }

    saveEvents() {
        localStorage.setItem('studyEvents', JSON.stringify(this.events));
    }

    async requestNotificationPermission() {
        if ('Notification' in window && 'serviceWorker' in navigator) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                navigator.serviceWorker.register('sw.js');
            }
        }
    }

    scheduleNotifications() {
        if ('Notification' in window && Notification.permission === 'granted') {
            // Clear existing timeouts
            if (this.notificationTimeouts) {
                this.notificationTimeouts.forEach(timeout => clearTimeout(timeout));
            }
            this.notificationTimeouts = [];

            this.events.forEach(event => {
                const eventDateTime = new Date(event.date + 'T' + event.time);
                const notificationTime = new Date(eventDateTime.getTime() - 15 * 60 * 1000); // 15 minutes before
                const now = new Date();

                if (notificationTime > now) {
                    const timeout = setTimeout(() => {
                        new Notification(`${event.type.charAt(0).toUpperCase() + event.type.slice(1)} Reminder`, {
                            body: `${event.title} is starting in 15 minutes`,
                            icon: 'icon-192.png',
                            badge: 'icon-192.png'
                        });
                    }, notificationTime.getTime() - now.getTime());

                    this.notificationTimeouts.push(timeout);
                }
            });
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StudyCalendar();
});

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}
