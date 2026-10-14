export const STORAGE_KEY = 'lro-expense-splitter-v1';
export const DEFAULT_CATEGORIES = ['Food & drink', 'Groceries', 'Travel', 'Home', 'Utilities', 'Entertainment', 'Other'];
export const emptyData = () => ({ people: [], groups: [], categories: [...DEFAULT_CATEGORIES], expenses: [], payments: [] });
export const id = () => crypto.randomUUID();
export const cents = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7) throw new Error('Enter a valid amount with at most two decimal places.');
    return Math.round(amount * 100);
};
export const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
export const nameOf = (data, personId) => data.people.find(person => person.id === personId)?.name ?? 'Unknown person';
export function splitEqual(total, memberIds) {
    if (!memberIds.length) throw new Error('Choose at least one person to split with.');
    const each = Math.floor(total / memberIds.length);
    return memberIds.map((userId, index) => ({ userId, amountCents: each + (index < total % memberIds.length ? 1 : 0) }));
}
export function createExpense(data, details) {
    const group = data.groups.find(item => item.id === details.groupId);
    if (!group) throw new Error('Choose a group.');
    if (!details.description.trim()) throw new Error('Add a description.');
    if (!data.categories.includes(details.category)) throw new Error('Choose a category.');
    if (!group.members.includes(details.payerId)) throw new Error('Choose a payer in this group.');
    const total = cents(details.amount);
    let shares;
    if (details.mode === 'direct') {
        if (!group.members.includes(details.debtorId) || details.debtorId === details.payerId) throw new Error('Choose another group member who owes the amount.');
        shares = [{ userId: details.debtorId, amountCents: total }];
    } else if (details.split === 'equal') {
        const selected = [...new Set(details.members)];
        if (selected.some(member => !group.members.includes(member))) throw new Error('Choose people in this group.');
        shares = splitEqual(total, selected);
    } else {
        const selected = [...new Set(details.members)];
        if (!selected.length || selected.some(member => !group.members.includes(member))) throw new Error('Choose people in this group.');
        shares = selected.map(userId => ({ userId, amountCents: cents(details.custom[userId]) }));
        if (shares.reduce((sum, share) => sum + share.amountCents, 0) !== total) throw new Error('Custom shares must add up to the full amount.');
    }
    const expense = { id: id(), groupId: group.id, description: details.description.trim(), category: details.category, payerId: details.payerId, amountCents: total, shares, createdAt: new Date().toISOString() };
    data.expenses.push(expense);
    return expense;
}
export function obligations(data, groupId) {
    const paid = new Map();
    for (const payment of data.payments) {
        if (payment.groupId !== groupId) continue;
        for (const applied of payment.applied) paid.set(applied.key, (paid.get(applied.key) ?? 0) + applied.amountCents);
    }
    return data.expenses.filter(expense => expense.groupId === groupId).flatMap(expense => expense.shares
        .filter(share => share.userId !== expense.payerId)
        .map(share => {
            const key = `${expense.id}:${share.userId}`;
            return { key, expense, debtorId: share.userId, creditorId: expense.payerId, amountCents: share.amountCents, paidCents: paid.get(key) ?? 0, remainingCents: Math.max(0, share.amountCents - (paid.get(key) ?? 0)) };
        })).sort((a, b) => a.expense.createdAt.localeCompare(b.expense.createdAt) || a.key.localeCompare(b.key));
}
export function outstandingByPerson(data, groupId) {
    const totals = new Map();
    for (const item of obligations(data, groupId)) {
        if (item.remainingCents > 0) totals.set(item.debtorId, (totals.get(item.debtorId) ?? 0) + item.remainingCents);
    }
    return totals;
}
export function settle(data, groupId, debtorId, creditorId, amountCents, onlyKey = null) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Enter a payment greater than zero.');
    if (debtorId === creditorId) throw new Error('Choose two different people.');
    const available = obligations(data, groupId).filter(item => item.debtorId === debtorId && item.creditorId === creditorId && item.remainingCents > 0 && (!onlyKey || item.key === onlyKey));
    const outstanding = available.reduce((sum, item) => sum + item.remainingCents, 0);
    if (amountCents > outstanding) throw new Error(`The most that can be cleared is ${money(outstanding)}.`);
    let left = amountCents;
    const applied = [];
    for (const item of available) {
        if (!left) break;
        const take = Math.min(left, item.remainingCents);
        applied.push({ key: item.key, amountCents: take });
        left -= take;
    }
    data.payments.push({ id: id(), groupId, fromId: debtorId, toId: creditorId, amountCents, applied, createdAt: new Date().toISOString() });
}
export function balances(data, groupId) {
    const result = new Map();
    for (const item of obligations(data, groupId)) {
        result.set(item.debtorId, (result.get(item.debtorId) ?? 0) - item.remainingCents);
        result.set(item.creditorId, (result.get(item.creditorId) ?? 0) + item.remainingCents);
    }
    return result;
}
export function loadData() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (parsed && Array.isArray(parsed.people) && Array.isArray(parsed.groups) && Array.isArray(parsed.expenses) && Array.isArray(parsed.payments) && Array.isArray(parsed.categories)) return parsed;
    } catch { /* Ignore damaged local data and start fresh. */ }
    return emptyData();
}
export function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
