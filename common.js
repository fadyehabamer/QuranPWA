// Modal Functions
function showModal(options) {
    const modal = document.getElementById('customModal');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const actions = document.getElementById('modalActions');

    // Set icon
    icon.className = `modal-icon ${options.type || 'info'}`;
    if (options.icon && options.icon.includes('<')) {
        icon.innerHTML = options.icon;
    } else {
        icon.textContent = options.icon || '✓';
    }

    // Set content
    title.textContent = options.title || '';
    message.innerHTML = options.message || '';

    // Set actions
    actions.innerHTML = '';
    
    if (options.confirmText) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'modal-btn modal-btn-primary';
        confirmBtn.textContent = options.confirmText;
        confirmBtn.onclick = () => {
            hideModal();
            if (options.onConfirm) options.onConfirm();
        };
        actions.appendChild(confirmBtn);
    }

    if (options.cancelText) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn modal-btn-secondary';
        cancelBtn.textContent = options.cancelText;
        cancelBtn.onclick = () => {
            hideModal();
            if (options.onCancel) options.onCancel();
        };
        actions.appendChild(cancelBtn);
    }

    if (!options.confirmText && !options.cancelText) {
        const okBtn = document.createElement('button');
        okBtn.className = 'modal-btn modal-btn-primary';
        okBtn.textContent = 'حسناً';
        okBtn.onclick = hideModal;
        actions.appendChild(okBtn);
    }

    modal.classList.add('active');
}

function hideModal() {
    const modal = document.getElementById('customModal');
    modal.classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }
});
