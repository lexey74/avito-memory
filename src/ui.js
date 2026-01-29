/**
 * ui.js
 * Handles rendering of the control panel and badges.
 */

const UI = {
    /**
     * Created a simple status badge (circle) for list views.
     * Only shown if status is present.
     * @param {string} status - 'good', 'average', 'bad'
     * @param {string} note - User comment
     * @returns {HTMLElement|null}
     */
    createStatusBadge(status, note) {
        if (!status) return null;

        const statusConfig = {
            good: { label: '👍', color: '#4caf50' },
            average: { label: '📌', color: '#ff9800' },
            bad: { label: '👎', color: '#f44336' }
        };

        const config = statusConfig[status] || { label: '?', color: '#999' };

        const badge = document.createElement('div');
        badge.textContent = config.label;
        badge.style.position = 'absolute';
        badge.style.bottom = '8px'; // Moved to bottom
        badge.style.left = '8px';   // Kept at left
        badge.style.zIndex = '100';
        badge.style.width = '28px'; // Slightly larger for emoji
        badge.style.height = '28px';
        badge.style.borderRadius = '50%';
        badge.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // White background for contrast
        badge.style.backdropFilter = 'blur(4px)';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontSize = '18px';
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        badge.style.cursor = 'help';

        // Click to toggle comment bubble
        badge.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Check if bubble already exists (global check since we append to body now)
            const existingBubble = document.getElementById('am-global-bubble');
            if (existingBubble) {
                // If clicking same badge, just toggle off
                const isSame = existingBubble.dataset.triggerId === (note || 'empty');
                existingBubble.remove();
                if (isSame) return;
            }

            // Create bubble
            const bubble = document.createElement('div');
            bubble.id = 'am-global-bubble';
            bubble.dataset.triggerId = note || 'empty';
            bubble.className = 'am-note-bubble';
            bubble.textContent = note || '<пусто>';

            // Calculate Position
            const rect = badge.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            // Styling
            bubble.style.position = 'absolute';
            bubble.style.backgroundColor = '#333';
            bubble.style.color = '#fff';
            bubble.style.padding = '8px 12px';
            bubble.style.borderRadius = '6px';
            bubble.style.fontSize = '14px';
            bubble.style.zIndex = '2147483647'; // Max z-index
            bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            bubble.style.minWidth = '100px';
            bubble.style.maxWidth = '200px';
            bubble.style.textAlign = 'center';
            bubble.style.whiteSpace = 'normal'; // Allow wrapping
            bubble.style.fontFamily = 'Arial, sans-serif';
            bubble.style.lineHeight = '1.4';

            // Triangle arrow (pseudo-element style manually)
            const arrow = document.createElement('div');
            arrow.style.position = 'absolute';
            arrow.style.bottom = '-6px';
            arrow.style.left = '50%';
            arrow.style.marginLeft = '-6px';
            arrow.style.width = '0';
            arrow.style.height = '0';
            arrow.style.borderLeft = '6px solid transparent';
            arrow.style.borderRight = '6px solid transparent';
            arrow.style.borderTop = '6px solid #333';
            bubble.appendChild(arrow);

            document.body.appendChild(bubble);

            // Correct position after append (so we know width/height)
            const bubbleHeight = bubble.offsetHeight;
            const bubbleWidth = bubble.offsetWidth;

            // Center horizontally relative to badge
            let top = rect.top + scrollTop - bubbleHeight - 8;
            let left = rect.left + scrollLeft + (rect.width / 2) - (bubbleWidth / 2);

            bubble.style.top = `${top}px`;
            bubble.style.left = `${left}px`;

            // Auto-close after 4 seconds or click anywhere
            const closeHandler = () => {
                if (bubble.parentElement) bubble.remove();
                document.removeEventListener('click', closeHandler);
            };

            // Delay adding click listener to avoid immediate close
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 0);

            setTimeout(() => {
                if (bubble.parentElement) bubble.remove();
            }, 4000);
        };

        return badge;
    },

    /**
     * Creates the full control panel for Single Item View.
     * @param {string} currentStatus - 'good', 'average', 'bad', or null
     * @param {string} currentNote - existing note or ''
     * @param {function} onSave - callback(status, note)
     * @returns {HTMLElement}
     */
    createControlPanel(currentStatus, currentNote, onSave) {
        if (document.getElementById('avito-memory-panel-root')) {
            return null; // Already exists globally, or we can check strict context
        }

        const container = document.createElement('div');
        container.className = 'avito-memory-panel';
        container.id = 'avito-memory-panel-root';
        container.style.marginTop = '12px';
        container.style.padding = '16px';
        container.style.backgroundColor = '#ffffff';
        container.style.borderRadius = '12px';
        container.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'; // Softer shadow to match Avito
        container.style.border = '1px solid #e0e0e0';
        container.style.fontFamily = 'Arial, sans-serif';
        // Stop propagation
        container.addEventListener('click', (e) => e.stopPropagation());
        container.addEventListener('mousedown', (e) => e.stopPropagation());

        // 1. Buttons Row
        const btnRow = document.createElement('div');
        btnRow.className = 'am-buttons-row';

        const statuses = [
            { id: 'good', label: '👍', color: '#4caf50' },
            { id: 'average', label: '📌', color: '#ff9800' },
            { id: 'bad', label: '👎', color: '#f44336' }
        ];

        let activeStatus = currentStatus;
        // The noteInput is now replaced by commentInput and its handling is moved to the save button.

        statuses.forEach(s => {
            const btn = document.createElement('button');
            btn.textContent = s.label; // Use emoji label
            btn.className = `am-btn`;
            btn.title = s.id;

            // Basic styling for buttons in the panel
            btn.style.fontSize = '20px';
            btn.style.width = '42px';
            btn.style.height = '42px';
            btn.style.borderRadius = '50%';
            btn.style.border = '2px solid #ddd';
            btn.style.background = 'white';
            btn.style.marginRight = '8px';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.transition = 'all 0.2s ease';

            if (activeStatus === s.id) {
                btn.classList.add('selected');
                // active style
                btn.style.backgroundColor = s.color; // Used as background or border? Let's use as bg for active
                btn.style.borderColor = s.color;
                btn.style.backgroundColor = '#fff';
                btn.style.boxShadow = `inset 0 0 0 4px ${s.color}`; // Highlight
            }

            btn.onclick = () => {
                // Toggle logic
                btnRow.querySelectorAll('.am-btn').forEach(b => b.classList.remove('selected'));
                // Reset styles
                btnRow.querySelectorAll('.am-btn').forEach(b => {
                    b.style.backgroundColor = 'white';
                    b.style.boxShadow = 'none';
                });


                if (activeStatus === s.id) {
                    activeStatus = null;
                } else {
                    activeStatus = s.id;
                    btn.classList.add('selected');
                    btn.style.boxShadow = `inset 0 0 0 4px ${s.color}`;
                }

                // Trigger save on status change
                // (Previously this was just setting state, but typically status change should save immediately too or wait for blur?
                // Let's assume status change saves immediately for responsiveness).
                onSave(activeStatus, commentInput.value);
            };

            btnRow.appendChild(btn);
        });

        container.appendChild(btnRow);

        // Comment Area
        const commentContainer = document.createElement('div');
        commentContainer.style.marginTop = '12px';

        const commentInput = document.createElement('textarea');
        commentInput.placeholder = 'Комментарий...';
        commentInput.style.width = '100%';
        commentInput.style.minHeight = '60px';
        commentInput.style.padding = '8px';
        commentInput.style.marginTop = '8px';
        commentInput.style.border = '1px solid #ccc';
        commentInput.style.borderRadius = '4px';
        commentInput.style.resize = 'vertical';
        commentInput.value = currentNote || ''; // Use currentNote from function params

        // Auto-save on blur (loss of focus)
        commentInput.addEventListener('blur', () => {
            onSave(activeStatus, commentInput.value);
        });

        commentContainer.appendChild(commentInput);
        container.appendChild(commentContainer);

        return container;
    }
};

window.AvitoMemoryUI = UI;
