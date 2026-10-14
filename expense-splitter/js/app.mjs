import { loadData, saveData, id, cents, money, nameOf, createExpense, obligations, settle, balances } from './model.mjs';

let data = loadData();
let selectedGroupId = data.groups[0]?.id ?? null;
const app = document.querySelector('#app-content');
const dialog = document.querySelector('#dialog');
const dialogContent = document.querySelector('#dialog-content');
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const personOptions = ids => ids.map(personId => `<option value="${esc(personId)}">${esc(nameOf(data, personId))}</option>`).join('');
const categoryIcon = category => ({ 'Food & drink': '♨', Groceries: '▦', Travel: '↗', Home: '⌂', Utilities: '✦', Entertainment: '♫' })[category] ?? '◈';
const activeGroup = () => data.groups.find(group => group.id === selectedGroupId);
const persist = () => { saveData(data); render(); };
function toast(message) { const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 2600); }
function openDialog(title, subtitle, body, onSubmit, buttonText = 'Save') {
    dialogContent.innerHTML = `<div class="dialog-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="close" type="button" aria-label="Close">×</button></div><form id="modal-form" class="dialog-body"><div class="error" id="form-error"></div>${body}<div class="form-actions"><button class="secondary" type="button" id="cancel-dialog">Cancel</button><button class="primary" type="submit">${buttonText}</button></div></form>`;
    dialogContent.querySelector('.close').onclick = closeDialog;
    dialogContent.querySelector('#cancel-dialog').onclick = closeDialog;
    dialogContent.querySelector('form').onsubmit = event => {
        event.preventDefault();
        try { onSubmit(new FormData(event.currentTarget), event.currentTarget); closeDialog(); persist(); }
        catch (error) { const box = dialogContent.querySelector('#form-error'); box.textContent = error.message; box.classList.add('show'); }
    };
    dialog.showModal();
    dialogContent.querySelector('input:not([type=checkbox]), select')?.focus();
}
function closeDialog() { dialog.close(); }
dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
function render() {
    const group = activeGroup();
    document.querySelector('#breadcrumb').textContent = group ? `Groups  /  ${group.name}` : 'Overview';
    document.querySelector('#group-nav').innerHTML = data.groups.map(item => `<button class="nav-item ${item.id === selectedGroupId ? 'active' : ''}" data-group="${esc(item.id)}"><span class="nav-icon">◈</span>${esc(item.name)}</button>`).join('') || '<span class="muted" style="padding:10px 12px">No groups yet</span>';
    document.querySelectorAll('[data-group]').forEach(button => button.onclick = () => { selectedGroupId = button.dataset.group; render(); });
    if (!group) return renderWelcome();
    const all = obligations(data, group.id);
    const open = all.filter(item => item.remainingCents > 0);
    const total = open.reduce((sum, item) => sum + item.remainingCents, 0);
    const groupBalances = balances(data, group.id);
    const unpaidPeople = [...groupBalances.values()].filter(value => value < 0).length;
    const rows = open.slice().reverse().map(item => `<div class="expense-row"><span class="category-icon">${categoryIcon(item.expense.category)}</span><div><div class="row-title">${esc(item.expense.description)}</div><div class="row-sub">${esc(item.expense.category)} · ${new Date(item.expense.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div><div class="row-person">Paid by<strong>${esc(nameOf(data, item.creditorId))}</strong></div><div class="row-person">Owed by<strong>${esc(nameOf(data, item.debtorId))}</strong></div><div class="row-amount">${money(item.remainingCents)}<small>${item.paidCents ? `${money(item.paidCents)} paid` : 'outstanding'}</small></div><button class="small-button" data-settle="${esc(item.key)}">Mark paid</button></div>`).join('');
    app.innerHTML = `<div class="content"><div class="hero"><p class="eyebrow">SHARED EXPENSES, SIMPLIFIED</p><div class="hero-line"><div><h1>${esc(group.name)}</h1><p>A clear view of what everyone still owes.</p></div><div class="button-row"><button class="secondary" id="add-members">+ Add members</button><button class="primary" id="add-expense">+ Add expense</button></div></div><div class="member-list">${group.members.map(personId => `<span class="member-pill">${esc(nameOf(data, personId))}</span>`).join('')}</div></div><div class="stats"><div class="stat"><div class="stat-label">Total outstanding</div><div class="stat-value accent">${money(total)}</div><div class="stat-foot">Across all unpaid shares</div></div><div class="stat"><div class="stat-label">Open items</div><div class="stat-value">${open.length}</div><div class="stat-foot">Individual amounts owed</div></div><div class="stat"><div class="stat-label">People owing</div><div class="stat-value">${unpaidPeople}</div><div class="stat-foot">With an outstanding balance</div></div></div><div class="section-bar"><div><h2>Outstanding expenses</h2><p>Each share is shown separately so you can settle individual items.</p></div><div class="button-row"><span class="pill">${open.length} OPEN</span><button class="secondary" id="record-payment">Record payment</button></div></div><div class="panel">${rows || '<div class="empty"><div class="empty-illustration">✓</div><strong>All settled up</strong><p>Add an expense to start tracking what the group owes.</p></div>'}</div><div class="section-bar"><div><h2>Payment history</h2><p>Payments are applied to the oldest matching expenses first.</p></div></div><div class="panel">${renderHistory(group.id)}</div></div>`;
    document.querySelector('#add-members').onclick = () => showGroupDialog(group);
    document.querySelector('#add-expense').onclick = showExpenseDialog;
    document.querySelector('#record-payment').onclick = showPaymentDialog;
    document.querySelectorAll('[data-settle]').forEach(button => button.onclick = () => { const item = obligations(data, group.id).find(entry => entry.key === button.dataset.settle); if (!item) return; settle(data, group.id, item.debtorId, item.creditorId, item.remainingCents, item.key); persist(); toast('Item marked paid'); });
}
function renderHistory(groupId) {
    const payments = data.payments.filter(payment => payment.groupId === groupId).slice().reverse();
    return payments.length ? payments.map(payment => `<div class="history-row"><div><strong>${esc(nameOf(data, payment.fromId))}</strong> paid <strong>${esc(nameOf(data, payment.toId))}</strong><br><span>${new Date(payment.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${payment.applied.length} item${payment.applied.length === 1 ? '' : 's'} cleared</span></div><strong>${money(payment.amountCents)}</strong></div>`).join('') : '<div class="empty" style="padding:28px"><p>No payments recorded yet.</p></div>';
}
function renderWelcome() {
    app.innerHTML = `<div class="content"><div class="hero"><p class="eyebrow">SHARED EXPENSES, SIMPLIFIED</p><h1>Good together. Even better settled.</h1><p>Keep your group spending clear, from the first bill to the last payment.</p></div><div class="welcome"><div><h2>Start with your people.</h2><p>Create a group for a trip, household, or any shared plan. Add people, log what was spent, and see exactly what is still owed.</p><button class="primary" id="welcome-group">+ Create your first group</button></div><div class="welcome-art">✳</div></div><div class="helper-card"><strong>Private to this browser.</strong> Everything you add is saved in this device's local storage. People you add here are labels for tracking expenses, not invited accounts.</div></div>`;
    document.querySelector('#welcome-group').onclick = () => showGroupDialog();
}
function showPeopleDialog() {
    const body = `<label class="field"><span>Person's name</span><input name="name" placeholder="e.g. Alex" required maxlength="60"></label><p class="footnote">People are names used within groups. They do not need an account.</p><div class="stack-list">${data.people.map(person => `<div class="stack-item">${esc(person.name)}</div>`).join('') || '<div class="stack-item">No people added yet</div>'}</div>`;
    openDialog('Add a person', 'Build your list of people to share expenses with.', body, form => {
        const name = String(form.get('name')).trim();
        if (!name) throw new Error('Enter a name.');
        if (data.people.some(person => person.name.toLowerCase() === name.toLowerCase())) throw new Error('That person already exists.');
        data.people.push({ id: id(), name }); toast(`${name} added`);
    }, 'Add person');
}
function showCategoriesDialog() {
    const body = `<label class="field"><span>Category name</span><input name="name" placeholder="e.g. Activities" required maxlength="50"></label><div class="stack-list">${data.categories.map(category => `<div class="stack-item">${esc(category)}</div>`).join('')}</div>`;
    openDialog('Add a category', 'Use categories to keep your expenses organized.', body, form => {
        const name = String(form.get('name')).trim();
        if (!name) throw new Error('Enter a category name.');
        if (data.categories.some(category => category.toLowerCase() === name.toLowerCase())) throw new Error('That category already exists.');
        data.categories.push(name); toast('Category added');
    }, 'Add category');
}
function showGroupDialog(group = null) {
    const body = `${group ? '' : '<label class="field"><span>Group name</span><input name="name" placeholder="e.g. Summer trip" required maxlength="70"></label>'}<span class="field-label">${group ? 'Add people to this group' : 'Choose group members'}</span><div class="checks">${data.people.map(person => `<div class="check-row"><label><input type="checkbox" name="members" value="${esc(person.id)}" ${group?.members.includes(person.id) ? 'checked' : ''}>${esc(person.name)}</label></div>`).join('') || '<div class="check-row">No people yet. Add a new person below.</div>'}</div><label class="field"><span>Add a new person (optional)</span><input name="newPerson" placeholder="e.g. Jordan" maxlength="60"></label><p class="footnote">You can add more people later from the sidebar.</p>`;
    openDialog(group ? 'Group members' : 'Create a group', group ? `Manage who is in ${esc(group.name)}.` : 'A space for expenses shared with your people.', body, form => {
        let members = form.getAll('members');
        const name = group ? group.name : String(form.get('name')).trim();
        if (!name) throw new Error('Enter a group name.');
        const newName = String(form.get('newPerson')).trim();
        if (newName) {
            let person = data.people.find(item => item.name.toLowerCase() === newName.toLowerCase());
            if (!person) { person = { id: id(), name: newName }; data.people.push(person); }
            members.push(person.id);
        }
        members = [...new Set(members)];
        if (!members.length) throw new Error('Add at least one person to the group.');
        if (group) group.members = [...new Set([...group.members, ...members])];
        else {
            const created = { id: id(), name, members };
            data.groups.push(created); selectedGroupId = created.id;
        }
        toast(group ? 'Members updated' : 'Group created');
    }, group ? 'Save members' : 'Create group');
}
function showExpenseDialog() {
    const group = activeGroup(); if (!group) return;
    const memberChecks = group.members.map(personId => `<div class="check-row"><label><input type="checkbox" name="members" value="${esc(personId)}" checked>${esc(nameOf(data, personId))}</label><input class="custom-amount" type="number" min="0.01" step="0.01" placeholder="0.00" data-person="${esc(personId)}" hidden aria-label="${esc(nameOf(data, personId))} share"></div>`).join('');
    const body = `<div class="toggle" id="expense-mode"><button type="button" data-mode="split" class="selected">Split a bill</button><button type="button" data-mode="direct">One person owes</button></div><label class="field"><span>Description</span><input name="description" placeholder="What was this for?" required maxlength="120"></label><div class="form-grid"><label class="field"><span>Amount (£)</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required></label><label class="field"><span>Category</span><select name="category">${data.categories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></label></div><label class="field"><span>Paid by</span><select name="payer">${personOptions(group.members)}</select></label><div id="split-area"><div class="toggle" id="split-type"><button type="button" data-split="equal" class="selected">Split equally</button><button type="button" data-split="custom">Custom amounts</button></div><span class="field-label">Split between</span><div class="checks">${memberChecks}</div><p class="footnote" id="split-hint">The full amount is divided evenly among selected people. A payer's own share does not become a debt.</p></div><div id="direct-area" hidden><label class="field"><span>Owed by</span><select name="debtor">${personOptions(group.members)}</select></label><p class="footnote">The full amount becomes one person's debt to the payer.</p></div>`;
    openDialog('Add an expense', `Record something shared in ${esc(group.name)}.`, body, (form, element) => {
        const mode = element.dataset.mode || 'split';
        const details = { groupId: group.id, description: form.get('description'), amount: form.get('amount'), category: form.get('category'), payerId: form.get('payer'), mode, debtorId: form.get('debtor'), split: element.dataset.split || 'equal', members: form.getAll('members'), custom: {} };
        element.querySelectorAll('[data-person]').forEach(input => { details.custom[input.dataset.person] = input.value; });
        createExpense(data, details); toast('Expense added');
    }, 'Add expense');
    const element = dialogContent.querySelector('form');
    element.dataset.mode = 'split'; element.dataset.split = 'equal';
    dialogContent.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
        element.dataset.mode = button.dataset.mode;
        dialogContent.querySelectorAll('[data-mode]').forEach(item => item.classList.toggle('selected', item === button));
        dialogContent.querySelector('#split-area').hidden = button.dataset.mode !== 'split';
        dialogContent.querySelector('#direct-area').hidden = button.dataset.mode !== 'direct';
    });
    dialogContent.querySelectorAll('[data-split]').forEach(button => button.onclick = () => {
        element.dataset.split = button.dataset.split;
        dialogContent.querySelectorAll('[data-split]').forEach(item => item.classList.toggle('selected', item === button));
        dialogContent.querySelectorAll('.custom-amount').forEach(input => input.hidden = button.dataset.split !== 'custom');
        dialogContent.querySelector('#split-hint').textContent = button.dataset.split === 'custom' ? 'Custom shares must add up to the full amount.' : "The full amount is divided evenly among selected people. A payer's own share does not become a debt.";
    });
}
function showPaymentDialog() {
    const group = activeGroup(); if (!group) return;
    const body = `<div class="form-grid"><label class="field"><span>Paid by</span><select name="from">${personOptions(group.members)}</select></label><label class="field"><span>Paid to</span><select name="to">${personOptions(group.members)}</select></label></div><div class="summary-box" id="payment-available"></div><label class="field"><span>Amount paid (£)</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required></label><p class="footnote">This payment clears the oldest outstanding items between these two people first. Partial payments are supported.</p>`;
    openDialog('Record a payment', 'Settle a total amount between two people.', body, form => {
        settle(data, group.id, form.get('from'), form.get('to'), cents(form.get('amount'))); toast('Payment recorded');
    }, 'Record payment');
    const update = () => {
        const from = dialogContent.querySelector('[name=from]').value;
        const to = dialogContent.querySelector('[name=to]').value;
        const total = obligations(data, group.id).filter(item => item.debtorId === from && item.creditorId === to).reduce((sum, item) => sum + item.remainingCents, 0);
        dialogContent.querySelector('#payment-available').innerHTML = `Outstanding between these people: <strong>${money(total)}</strong>`;
    };
    dialogContent.querySelectorAll('select').forEach(select => select.onchange = update);
    update();
}
document.querySelector('#new-group-side').onclick = () => showGroupDialog();
document.querySelector('#manage-people').onclick = showPeopleDialog;
document.querySelector('#manage-categories').onclick = showCategoriesDialog;
render();
