/**
 * neveralone/fe/js/ui.js
 * custom Modal Replacements for alert(), confirm(), prompt()
 */

function createModalBase(title, contentHTML, buttonsHTML) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-overlay custom-ui-modal open';

    backdrop.innerHTML = `
        <div class="modal-box" style="max-width: 400px; text-align: center; animation: popIn 0.2s ease-out;">
            <h3 style="margin-top:0;">${title}</h3>
            <div style="margin: 15px 0; color: var(--muted); font-size: 0.95rem;">
                ${contentHTML}
            </div>
            <div class="row" style="justify-content: center; gap: 10px; margin-top: 20px;">
                ${buttonsHTML}
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    return backdrop;
}

export function showAlert(title, message) {
    return new Promise((resolve) => {
        const btns = `<button class="btn primary" id="ui-ok">OK</button>`;
        const modal = createModalBase(title, message, btns);

        const btnOk = modal.querySelector('#ui-ok');

        function close() {
            modal.remove();
            resolve();
        }

        btnOk.onclick = close;
        // Allow Enter key
        btnOk.focus();
    });
}

export function showConfirm(title, message) {
    return new Promise((resolve) => {
        const btns = `
            <button class="btn" id="ui-cancel">Cancel</button>
            <button class="btn primary" id="ui-confirm">Confirm</button>
        `;
        const modal = createModalBase(title, message, btns);

        const btnYes = modal.querySelector('#ui-confirm');
        const btnNo = modal.querySelector('#ui-cancel');

        function close(result) {
            modal.remove();
            resolve(result);
        }

        btnYes.onclick = () => close(true);
        btnNo.onclick = () => close(false);
        btnYes.focus();
    });
}

export function showPrompt(title, message, defaultValue = "") {
    return new Promise((resolve) => {
        const content = `
            <p>${message}</p>
            <input type="text" id="ui-input" value="${defaultValue}" class="ui-prompt-input" style="width: 100%; margin-top: 10px;">
        `;
        const btns = `
            <button class="btn" id="ui-cancel">Cancel</button>
            <button class="btn primary" id="ui-confirm">Submit</button>
        `;

        const modal = createModalBase(title, content, btns);
        const input = modal.querySelector('#ui-input');
        const btnYes = modal.querySelector('#ui-confirm');
        const btnNo = modal.querySelector('#ui-cancel');

        function close(value) {
            modal.remove();
            resolve(value);
        }

        btnYes.onclick = () => close(input.value);
        btnNo.onclick = () => close(null);

        input.focus();
        input.select(); // Auto select text

        // Allow Enter to submit
        input.onkeydown = (e) => {
            if(e.key === 'Enter') close(input.value);
        };
    });
}