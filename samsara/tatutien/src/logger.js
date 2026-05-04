import { state } from './state.js';

export function logCombat(msg) {
    const time = new Date().toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });
    
    // Thêm log mới vào đầu mảng
    state.combatLogs.unshift(`[${time}] ${msg}`);
    
    // Giữ tối đa 5 log
    if (state.combatLogs.length > 5) {
        state.combatLogs.pop();
    }
}
